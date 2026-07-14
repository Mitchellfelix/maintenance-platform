#!/bin/bash
# Keep EMAT reachable on port 3000.
# Prefers Docker team app; falls back to local Node + existing Postgres container.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${EMAT_PORT:-3000}"
LOG_DIR="${HOME}/Library/Logs/EMAT"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/team-keep-alive.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

is_up() {
  curl -fsS --connect-timeout 2 "http://127.0.0.1:${PORT}/join" >/dev/null 2>&1
}

if is_up; then
  log "Already up on :${PORT}"
  exit 0
fi

# 1) Docker team stack (best: restart policies survive reboot when Docker starts at login)
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  log "Trying docker compose team stack…"
  if docker compose --profile team up -d >>"$LOG" 2>&1; then
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
      if is_up; then
        log "OK via Docker — http://127.0.0.1:${PORT}/join"
        exit 0
      fi
      sleep 2
    done
    log "Docker stack started but /join not ready — falling back to local Node"
  else
    log "Docker compose failed — falling back to local Node"
  fi
else
  log "Docker unavailable — using local Node"
fi

# 2) Local Node (uses Docker Postgres if present, or whatever DATABASE_URL says)
NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" && -x "${HOME}/.nvm/versions/node/v22.22.3/bin/node" ]]; then
  NODE_BIN="${HOME}/.nvm/versions/node/v22.22.3/bin/node"
fi
# Prefer whatever nvm default resolves when sourced
if [[ -z "$NODE_BIN" && -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "${HOME}/.nvm/nvm.sh"
  NODE_BIN="$(command -v node || true)"
fi

if [[ -z "$NODE_BIN" ]]; then
  log "No node binary found"
  exit 1
fi

# Ensure DB container is up if Docker works (local npm start usually needs it)
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker compose up -d db >>"$LOG" 2>&1 || true
fi

# Free stale listeners that are not healthy
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && ! is_up; then
  log "Clearing unhealthy listener on :${PORT}"
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | while read -r pid; do
    kill "$pid" 2>/dev/null || true
  done
  sleep 1
fi

log "Starting local Node server with ${NODE_BIN}"
mkdir -p "$ROOT/.run"
cd "$ROOT/server"
nohup env PORT="$PORT" "$NODE_BIN" index.js >>"$LOG" 2>&1 &
echo $! >"$ROOT/.run/api.pid"

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if is_up; then
    log "OK via local Node — http://127.0.0.1:${PORT}/join"
    exit 0
  fi
  sleep 1
done

log "Failed to bring :${PORT} up"
exit 1
