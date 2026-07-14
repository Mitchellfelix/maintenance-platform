#!/bin/bash
# Ensure the Docker team stack is up (idempotent). Used by LaunchAgent + manual checks.
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

if ! command -v docker >/dev/null 2>&1; then
  log "Docker CLI missing — skip"
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  log "Docker not running yet — skip (will retry)"
  exit 0
fi

# Free port 3000 if a leftover local npm/node server is holding it.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  if ! docker compose --profile team ps --status running 2>/dev/null | grep -q "maintenance-platform-app"; then
    log "Port ${PORT} in use by non-Docker process — stopping listeners so team app can bind"
    lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | while read -r pid; do
      kill "$pid" 2>/dev/null || true
    done
    sleep 1
  fi
fi

log "Starting team stack (docker compose --profile team up -d)"
docker compose --profile team up -d >>"$LOG" 2>&1 || {
  log "compose up failed"
  exit 1
}

if curl -fsS "http://127.0.0.1:${PORT}/join" >/dev/null 2>&1; then
  log "OK — http://127.0.0.1:${PORT}/join"
else
  log "Stack started but /join not ready yet"
fi

exit 0
