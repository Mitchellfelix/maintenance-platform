#!/bin/bash
# Start EMAT stack and open in the default browser (legacy launcher).
# Prefer the desktop app: npm run app:desktop / emat
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${EMAT_PORT:-3000}"
APP_URL="http://localhost:${PORT}"

if [[ -f "$ROOT/server/.env" ]]; then
  line="$(grep -E '^EMAT_APP_URL=' "$ROOT/server/.env" | tail -1 || true)"
  if [[ -n "$line" ]]; then
    APP_URL="${line#EMAT_APP_URL=}"
    APP_URL="${APP_URL%\"}"
    APP_URL="${APP_URL#\"}"
    APP_URL="${APP_URL%\'}"
    APP_URL="${APP_URL#\'}"
  fi
fi

"$ROOT/scripts/start-stack.sh"
open "$APP_URL"
