#!/bin/bash
# Show whether this Mac is in local vs team/Railway mode (counts only, no secrets).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/server/.env"
PORT="${EMAT_PORT:-3000}"

read_app_url() {
  local url="http://localhost:${PORT}"
  if [[ -f "$ENV_FILE" ]]; then
    local line
    line="$(grep -E '^EMAT_APP_URL=' "$ENV_FILE" | tail -1 || true)"
    if [[ -n "$line" ]]; then
      url="${line#EMAT_APP_URL=}"
      url="${url%\"}"
      url="${url#\"}"
      url="${url%\'}"
      url="${url#\'}"
    fi
  fi
  printf '%s' "$url"
}

is_local_app_url() {
  [[ "$1" =~ ^https?://localhost([:/]|$) ]] || [[ "$1" =~ ^https?://127\.0\.0\.1([:/]|$) ]]
}

APP_URL="$(read_app_url)"

echo "EMAT mode status"
echo "----------------"
if is_local_app_url "$APP_URL"; then
  echo "Mode:    LOCAL (solo database on this Mac)"
  echo "App URL: $APP_URL"
else
  echo "Mode:    TEAM / REMOTE (different database from this Mac)"
  echo "App URL: $APP_URL"
  echo "Note:    Local Docker/Postgres data is NOT what you see in the app."
fi
echo ""

echo -n "Local DB counts: "
if node "$ROOT/scripts/db-counts.js" --local 2>/dev/null; then
  :
else
  echo '{"error":"unreachable"}'
fi

if ! is_local_app_url "$APP_URL"; then
  echo -n "Remote health:   "
  if curl -fsS --connect-timeout 5 "${APP_URL}/api/health/db" >/dev/null 2>&1; then
    echo "ok"
  else
    echo "unreachable"
  fi

  # When linked to Railway Postgres, compare remote counts too (host machine only).
  if command -v railway >/dev/null 2>&1; then
    PUB="$(railway variables --service Postgres --kv 2>/dev/null | grep -E '^DATABASE_PUBLIC_URL=|^DATABASE_URL=' | head -1 | cut -d= -f2- || true)"
    if [[ -n "${PUB:-}" && "$PUB" != *"railway.internal"* ]]; then
      echo -n "Railway DB counts: "
      if DATABASE_URL="$PUB" node "$ROOT/scripts/db-counts.js" 2>/dev/null; then
        :
      else
        echo '{"error":"unreachable"}'
      fi
    fi
  fi
fi

echo ""
echo "Safe switch rules:"
echo "  team:connect   — blocked if remote looks emptier than local (unless EMAT_FORCE_TEAM_CONNECT=YES)"
echo "  team:disconnect — return this Mac to local solo mode"
echo "  railway:migrate — copy local data INTO Railway before connect"
