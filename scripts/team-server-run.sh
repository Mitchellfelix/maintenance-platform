#!/bin/bash
# Foreground team server for launchd KeepAlive.
# Starts Postgres (Docker) if possible, then runs the API on :3000.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${EMAT_PORT:-3000}"
LOG_DIR="${HOME}/Library/Logs/EMAT"
mkdir -p "$LOG_DIR" "$ROOT/.run"
LOG="$LOG_DIR/team-server.log"

export PATH="${HOME}/.nvm/versions/node/v22.22.3/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  log "node not found on PATH=$PATH"
  exit 1
fi

# Postgres: prefer existing Docker DB container (fast, restartable).
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  log "Ensuring Postgres container is up"
  (cd "$ROOT" && docker compose up -d db) >>"$LOG" 2>&1 || log "WARN: could not start db container"
  # Wait briefly for Postgres
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if docker exec maintenance-platform-db pg_isready -U maintenance -d maintenance_platform >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

# Free stale process on the port (not us — we are about to bind).
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  log "Clearing existing listener on :${PORT}"
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | while read -r pid; do
    kill "$pid" 2>/dev/null || true
  done
  sleep 1
fi

log "Starting API with $NODE_BIN on 0.0.0.0:${PORT}"
cd "$ROOT/server"
export PORT
export HOST=0.0.0.0
exec "$NODE_BIN" index.js >>"$LOG" 2>&1
