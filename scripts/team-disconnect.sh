#!/bin/bash
# Return this Mac to solo local mode (stop pointing at Railway/team URL).
# Does NOT delete Railway or local data.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/server/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No server/.env — already local/default."
  exit 0
fi

if ! grep -q '^EMAT_APP_URL=' "$ENV_FILE" 2>/dev/null; then
  echo "Already in local solo mode (no EMAT_APP_URL)."
  exit 0
fi

PREV="$(grep -E '^EMAT_APP_URL=' "$ENV_FILE" | tail -1 | sed 's/^EMAT_APP_URL=//; s/^["'\'']//; s/["'\'']$//')"
grep -v '^EMAT_APP_URL=' "$ENV_FILE" >"${ENV_FILE}.tmp"
mv "${ENV_FILE}.tmp" "$ENV_FILE"

{
  echo ""
  echo "# Previously team URL (disconnected $(date -u +%Y-%m-%dT%H:%MZ)): $PREV"
} >>"$ENV_FILE"

echo "Disconnected from team URL: $PREV"
echo "This Mac is back in LOCAL solo mode (http://localhost:${EMAT_PORT:-3000})."
echo "Railway/team data was not deleted."
echo ""
echo "Launch local app:  npm run app:launch"
echo "Check status:      npm run team:status"
