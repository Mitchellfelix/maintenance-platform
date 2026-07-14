#!/bin/bash
# Point this Mac's EMAT desktop app at a shared team server URL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/server/.env"
URL="${1:-}"

usage() {
  echo "Usage: npm run team:connect -- <team-url>"
  echo ""
  echo "Example:"
  echo "  npm run team:connect -- http://192.168.1.50:3000"
  echo "  npm run team:connect -- https://emat.yourcompany.internal"
  exit 1
}

[[ -n "$URL" ]] || usage

URL="${URL%/}"

if [[ ! "$URL" =~ ^https?:// ]]; then
  echo "Team URL must start with http:// or https://"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/server/.env.example" "$ENV_FILE"
  echo "Created server/.env from example."
fi

if grep -q '^EMAT_APP_URL=' "$ENV_FILE" 2>/dev/null; then
  grep -v '^EMAT_APP_URL=' "$ENV_FILE" >"${ENV_FILE}.tmp"
  mv "${ENV_FILE}.tmp" "$ENV_FILE"
fi

{
  echo ""
  echo "# Shared team server (set by npm run team:connect)"
  echo "EMAT_APP_URL=\"$URL\""
} >>"$ENV_FILE"

echo "Configured EMAT_APP_URL=$URL"
echo ""
echo "Installing desktop launcher..."
"$ROOT/scripts/install-app.sh"

echo ""
echo "Done. Team members can launch with:"
echo "  emat"
echo ""
echo "Or open in a browser:"
echo "  $URL"
