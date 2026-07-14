#!/bin/bash
# Stop the background EMAT server.
set -euo pipefail

LIB="$(cd "$(dirname "$0")/lib" && pwd)"
# shellcheck source=lib/emat-home.sh
source "$LIB/emat-home.sh"

ROOT="$(emat_require_home)"
PID_FILE="$ROOT/.emat-app.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "EMAT server is not running (no pid file)."
else
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    pkill -P "$PID" 2>/dev/null || true
    echo "Stopped EMAT server (pid $PID)."
  else
    echo "EMAT server pid file was stale."
  fi
  rm -f "$PID_FILE"
fi

# Always free the API port — node can outlive the npm pid file.
PORT="${EMAT_PORT:-3000}"
if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$PIDS" ]]; then
    echo "$PIDS" | xargs kill 2>/dev/null || true
    sleep 0.3
    PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$PIDS" ]]; then
      echo "$PIDS" | xargs kill -9 2>/dev/null || true
    fi
    echo "Freed port $PORT."
  fi
fi

