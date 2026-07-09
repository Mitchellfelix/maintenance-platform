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
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Stopped EMAT server (pid $PID)."
else
  echo "EMAT server was not running."
fi

rm -f "$PID_FILE"
