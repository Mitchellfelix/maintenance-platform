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
  curl -fsS "${APP_URL}/api/health/db" >/dev/null 2>&1
}

port_listener_pids() {
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
}

write_listener_pid() {
  local listen_pid=""
  listen_pid="$(port_listener_pids | head -n 1 | tr -d '[:space:]')"
  if [[ -n "$listen_pid" ]]; then
    echo "$listen_pid" >"$PID_FILE"
  fi
}

wait_for_server() {
  local tries=0
  while (( tries < 60 )); do
    if server_healthy; then
      write_listener_pid
      return 0
    fi
    sleep 0.5
    tries=$((tries + 1))
  done
  return 1
}

wait_for_port_free() {
  local tries=0
  local pids=""
  while (( tries < 20 )); do
    pids="$(port_listener_pids)"
    if [[ -z "$pids" ]]; then
      return 0
    fi
    sleep 0.25
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
    # Docker Desktop stopped, but Postgres may still be reachable from an earlier start.
    if curl -fsS "http://127.0.0.1:${PORT}/api/health/db" >/dev/null 2>&1 \
      || nc -z 127.0.0.1 5432 >/dev/null 2>&1; then
      echo "Docker Desktop is not running, but PostgreSQL is already reachable."
      return 0
    fi
    alert "Docker is installed but not running. Start Docker Desktop, then open EMAT again."
    exit 1
  fi

  notify "Starting database..."
  if ! (cd "$ROOT" && docker compose up -d db >>"$LOG_FILE" 2>&1); then
    alert "Could not start PostgreSQL. See $LOG_FILE (is Docker Desktop running?)."
    exit 1
  fi

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

free_port() {
  local pids=""
  pids="$(port_listener_pids)"
  if [[ -z "$pids" ]]; then
    return 0
  fi
  # Kill whatever still owns the API port (npm wrapper PIDs often diverge from node).
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  sleep 0.4
  pids="$(port_listener_pids)"
  if [[ -n "$pids" ]]; then
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
  wait_for_port_free || true
}

stop_local_server() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
      # Also stop children if PID was an npm wrapper.
      pkill -P "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  free_port
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

  # Reuse a healthy server even if the npm wrapper pid file is stale/dead.
  # Without this, relaunch kills a live node then races on port 3000 (works once, fails next).
  if server_healthy && ! needs_server_restart; then
    write_listener_pid
    return 0
  fi

  # Always release the port before start — a stale node can outlive the pid file.
  stop_local_server

  if ! wait_for_port_free; then
    local still_held
    still_held="$(port_listener_pids | tr '\n' ' ')"
    alert "Port $PORT is still in use (pid ${still_held:-unknown}). Quit EMAT / run npm run app:stop, then try again."
    exit 1
  fi

  notify "Safety backup before database updates..."
  if ! bash "$ROOT/scripts/backup-db.sh" >>"$LOG_FILE" 2>&1; then
    echo "WARNING: Database backup failed before migrate. Continuing with migrate only." >>"$LOG_FILE"
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
    free_port
    alert "Server failed to start. See $LOG_FILE for details."
    exit 1
  fi
}

read_remote_url

if ! is_local_app_url "$APP_URL"; then
  # Team / Railway mode: do not start local Docker Postgres or bind port 3000.
  echo "Remote team URL configured ($APP_URL) — skipping local server on port ${PORT}."
  if server_healthy; then
    exit 0
  fi
  alert "Cannot reach $APP_URL. Check your network, or run: npm run team:connect -- <url>"
  exit 1
fi

APP_URL="http://localhost:${PORT}"
start_database
start_local_server
