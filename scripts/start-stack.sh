#!/bin/bash
# Start database + API for EMAT (no browser). Used by the Electron desktop shell.
set -euo pipefail

LIB="$(cd "$(dirname "$0")/lib" && pwd)"
# shellcheck source=lib/emat-home.sh
source "$LIB/emat-home.sh"

ROOT="$(emat_require_home)"
PID_FILE="$ROOT/.emat-app.pid"
LOG_FILE="$ROOT/.emat-app.log"
PORT="${EMAT_PORT:-3000}"
APP_URL="${EMAT_APP_URL:-http://localhost:${PORT}}"

notify() {
  osascript -e "display notification \"$1\" with title \"EMAT Tracking Database\"" 2>/dev/null || true
}

alert() {
  osascript -e "display alert \"EMAT Tracking Database\" message \"$1\" as critical" 2>/dev/null || {
    echo "ERROR: $1" >&2
  }
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    return 0
  fi
  for dir in /opt/homebrew/bin /usr/local/bin "$HOME/.nvm/versions/node/"*/bin; do
    if [[ -x "$dir/node" ]]; then
      export PATH="$dir:$PATH"
      return 0
    fi
  done
  alert "Node.js was not found. Install Node 20+ (brew install node) and try again."
  exit 1
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    return 0
  fi
  for dir in /opt/homebrew/bin /usr/local/bin; do
    if [[ -x "$dir/docker" ]]; then
      export PATH="$dir:$PATH"
      return 0
    fi
  done
  return 1
}

read_remote_url() {
  local env_file="$ROOT/server/.env"
  if [[ -f "$env_file" ]]; then
    local line
    line="$(grep -E '^EMAT_APP_URL=' "$env_file" | tail -1 || true)"
    if [[ -n "$line" ]]; then
      APP_URL="${line#EMAT_APP_URL=}"
      APP_URL="${APP_URL%\"}"
      APP_URL="${APP_URL#\"}"
      APP_URL="${APP_URL%\'}"
      APP_URL="${APP_URL#\'}"
    fi
  fi
}

is_local_app_url() {
  [[ "$1" =~ ^https?://localhost([:/]|$) ]] || [[ "$1" =~ ^https?://127\.0\.0\.1([:/]|$) ]]
}

server_healthy() {
  curl -fsS "${APP_URL}/api/health" >/dev/null 2>&1
}

server_running() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "$PID_FILE")"
  kill -0 "$pid" 2>/dev/null
}

wait_for_server() {
  local tries=0
  while (( tries < 60 )); do
    if server_healthy; then
      return 0
    fi
    sleep 0.5
    tries=$((tries + 1))
  done
  return 1
}

start_database() {
  if ! ensure_docker; then
    echo "Docker not found — assuming PostgreSQL is already running."
    return 0
  fi

  if ! docker info >/dev/null 2>&1; then
    alert "Docker is installed but not running. Start Docker Desktop, then open EMAT again."
    exit 1
  fi

  notify "Starting database..."
  (cd "$ROOT" && docker compose up -d db)

  local tries=0
  while (( tries < 40 )); do
    if (cd "$ROOT" && docker compose exec -T db pg_isready -U maintenance -d maintenance_platform >/dev/null 2>&1); then
      return 0
    fi
    sleep 0.5
    tries=$((tries + 1))
  done

  alert "PostgreSQL did not become ready. Check Docker and try again."
  exit 1
}

needs_ui_build() {
  if [[ ! -f "$ROOT/server/public/index.html" ]]; then
    return 0
  fi

  local built="$ROOT/server/public/index.html"
  if find "$ROOT/client/src" "$ROOT/client/index.html" "$ROOT/client/public" -newer "$built" -print -quit 2>/dev/null | grep -q .; then
    return 0
  fi

  return 1
}

needs_server_restart() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi

  local pid_time
  pid_time="$(stat -f %m "$PID_FILE" 2>/dev/null || stat -c %Y "$PID_FILE" 2>/dev/null || echo 0)"

  local newest=0
  local mtime
  while IFS= read -r file; do
    mtime="$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null || echo 0)"
    if (( mtime > newest )); then
      newest=$mtime
    fi
  done < <(find "$ROOT/server/src" "$ROOT/server/index.js" "$ROOT/server/prisma" -type f 2>/dev/null)

  if (( newest > pid_time )); then
    return 0
  fi

  if needs_ui_build; then
    return 0
  fi

  return 1
}

stop_local_server() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 0
  fi
  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
}

ensure_ui_build() {
  if needs_ui_build; then
    notify "Building latest UI for the desktop app..."
    if ! npm run build >>"$LOG_FILE" 2>&1; then
      alert "UI build failed. See $LOG_FILE for details."
      exit 1
    fi
  fi
}

start_local_server() {
  cd "$ROOT"
  ensure_node

  if [[ ! -f "$ROOT/server/.env" ]]; then
    if [[ -f "$ROOT/server/.env.example" ]]; then
      cp "$ROOT/server/.env.example" "$ROOT/server/.env"
      notify "Created server/.env from example — review JWT_SECRET before production use."
    else
      alert "Missing server/.env. Copy server/.env.example and configure DATABASE_URL."
      exit 1
    fi
  fi

  ensure_ui_build

  if server_running && server_healthy && ! needs_server_restart; then
    return 0
  fi

  if server_running; then
    stop_local_server
  fi

  notify "Applying database updates..."
  if ! npm run db:deploy >>"$LOG_FILE" 2>&1; then
    alert "Database migration failed. Check Docker and $LOG_FILE."
    exit 1
  fi

  notify "Starting EMAT server..."
  nohup npm start >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"

  if ! wait_for_server; then
    alert "Server failed to start. See $LOG_FILE for details."
    exit 1
  fi
}

read_remote_url

if ! is_local_app_url "$APP_URL"; then
  if server_healthy; then
    exit 0
  fi
  alert "Cannot reach $APP_URL. Connect to VPN or your network and try again."
  exit 1
fi

APP_URL="http://localhost:${PORT}"
start_database
start_local_server
