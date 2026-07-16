#!/bin/bash
# Point this Mac's EMAT desktop app at a shared team server URL.
#
# SAFETY: This does NOT migrate data. Switching modes only changes which
# database the desktop opens. Refuses when the remote looks empty/mismatched
# relative to local data unless EMAT_FORCE_TEAM_CONNECT=YES.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/server/.env"
URL="${1:-}"

usage() {
  echo "Usage: npm run team:connect -- <team-url>"
  echo ""
  echo "Example:"
  echo "  npm run team:connect -- https://emat-production.up.railway.app"
  echo ""
  echo "Before connecting to Railway, migrate local data:"
  echo "  EMAT_CONFIRM_MIGRATE=YES npm run railway:migrate"
  echo "  npm run team:status"
  echo ""
  echo "Override (dangerous): EMAT_FORCE_TEAM_CONNECT=YES npm run team:connect -- <url>"
  exit 1
}

[[ -n "$URL" ]] || usage

URL="${URL%/}"

if [[ ! "$URL" =~ ^https?:// ]]; then
  echo "Team URL must start with http:// or https://"
  exit 1
fi

if [[ "$URL" =~ ^https?://localhost([:/]|$) ]] || [[ "$URL" =~ ^https?://127\.0\.0\.1([:/]|$) ]]; then
  echo "Refusing: that URL is local. For solo mode run: npm run team:disconnect"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/server/.env.example" "$ENV_FILE"
  echo "Created server/.env from example."
fi

echo "Checking remote health at $URL ..."
if ! curl -fsS --connect-timeout 8 "${URL}/api/health/db" >/dev/null 2>&1; then
  echo "Refusing: cannot reach ${URL}/api/health/db"
  exit 1
fi
echo "Remote health: ok"

LOCAL_JSON="$(node "$ROOT/scripts/db-counts.js" --local 2>/dev/null || echo '{"error":"unreachable"}')"
LOCAL_USERS="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.users||0))" "$LOCAL_JSON" 2>/dev/null || echo 0)"
LOCAL_SITES="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.sites||0))" "$LOCAL_JSON" 2>/dev/null || echo 0)"
LOCAL_ASSETS="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.assets||0))" "$LOCAL_JSON" 2>/dev/null || echo 0)"
LOCAL_WOS="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.workOrders||0))" "$LOCAL_JSON" 2>/dev/null || echo 0)"
LOCAL_DATA=$((LOCAL_SITES + LOCAL_ASSETS + LOCAL_WOS))

echo "Local counts:  $LOCAL_JSON"

REMOTE_USERS=""
REMOTE_JSON=""
if command -v railway >/dev/null 2>&1; then
  PUB="$(railway variables --service Postgres --kv 2>/dev/null | grep -E '^DATABASE_PUBLIC_URL=|^DATABASE_URL=' | head -1 | cut -d= -f2- || true)"
  if [[ -n "${PUB:-}" && "$PUB" != *"railway.internal"* ]]; then
    REMOTE_JSON="$(DATABASE_URL="$PUB" node "$ROOT/scripts/db-counts.js" 2>/dev/null || echo '{"error":"unreachable"}')"
    REMOTE_USERS="$(node -e "const j=JSON.parse(process.argv[1]); if(j.error) process.exit(2); process.stdout.write(String(j.users||0))" "$REMOTE_JSON" 2>/dev/null || true)"
    echo "Remote counts: $REMOTE_JSON"
  fi
fi

if [[ "${EMAT_FORCE_TEAM_CONNECT:-}" != "YES" ]]; then
  if [[ -n "$REMOTE_USERS" ]]; then
    if (( LOCAL_USERS > 0 && REMOTE_USERS == 0 )); then
      echo ""
      echo "Refusing team:connect — local has $LOCAL_USERS user(s) but remote has 0."
      echo "That switch makes it look like accounts were erased (they were not)."
      echo ""
      echo "Do this first:"
      echo "  EMAT_CONFIRM_MIGRATE=YES npm run railway:migrate"
      echo "  npm run team:status"
      echo ""
      echo "Only if you really mean to open an empty remote DB:"
      echo "  EMAT_FORCE_TEAM_CONNECT=YES npm run team:connect -- $URL"
      exit 1
    fi
    if (( LOCAL_DATA > 0 )); then
      REMOTE_DATA="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(String((j.sites||0)+(j.assets||0)+(j.workOrders||0)))" "$REMOTE_JSON" 2>/dev/null || echo 0)"
      if (( REMOTE_DATA == 0 )); then
        echo ""
        echo "Refusing team:connect — local has sites/assets/work orders but remote looks empty."
        echo "Migrate first: EMAT_CONFIRM_MIGRATE=YES npm run railway:migrate"
        echo "Or override:   EMAT_FORCE_TEAM_CONNECT=YES npm run team:connect -- $URL"
        exit 1
      fi
    fi
  elif (( LOCAL_USERS > 0 || LOCAL_DATA > 0 )); then
    echo ""
    echo "Refusing team:connect — cannot verify remote DB contents, and this Mac still has local data."
    echo "Migrate + verify first:"
    echo "  EMAT_CONFIRM_MIGRATE=YES npm run railway:migrate"
    echo "  npm run team:status"
    echo ""
    echo "Or override only if you accept opening a possibly empty remote DB:"
    echo "  EMAT_FORCE_TEAM_CONNECT=YES npm run team:connect -- $URL"
    exit 1
  fi
else
  echo "WARNING: EMAT_FORCE_TEAM_CONNECT=YES — skipping empty/mismatch guards."
fi

echo ""
echo "IMPORTANT: team:connect does not copy data. It only points the desktop at:"
echo "  $URL"
echo "Your local Docker database stays on this Mac untouched."
echo ""

if grep -q '^EMAT_APP_URL=' "$ENV_FILE" 2>/dev/null; then
  grep -v '^EMAT_APP_URL=' "$ENV_FILE" >"${ENV_FILE}.tmp"
  mv "${ENV_FILE}.tmp" "$ENV_FILE"
fi

{
  echo ""
  echo "# Shared team server (set by npm run team:connect) — different DB than local solo mode"
  echo "EMAT_APP_URL=\"$URL\""
} >>"$ENV_FILE"

echo "Configured EMAT_APP_URL=$URL"
echo ""
echo "Stopping local team autostart / port ${EMAT_PORT:-3000} (team mode uses the remote host)..."
bash "$ROOT/scripts/uninstall-team-autostart.sh" >/dev/null 2>&1 || true
bash "$ROOT/scripts/stop-app.sh" >/dev/null 2>&1 || true

echo "Installing desktop launcher..."
"$ROOT/scripts/install-app.sh"

echo ""
echo "Done. This Mac now opens the team server (no local port ${EMAT_PORT:-3000})."
echo "  emat"
echo "  npm run team:status"
echo ""
echo "Or open in a browser:"
echo "  $URL"
echo ""
echo "Back to solo local mode:"
echo "  npm run team:disconnect"
