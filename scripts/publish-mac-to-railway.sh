#!/usr/bin/env bash
# Package the Mac team client and publish EMAT-mac.zip onto the Railway volume
# so https://YOUR-APP/install-mac and /downloads/EMAT-ready.zip work in the cloud.
#
# Prerequisites:
#   - railway CLI linked to the web service
#   - Volume mounted at /data with EMAT_DATA_DIR=/data on the service
#
# Usage:
#   npm run railway:publish-mac
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v railway >/dev/null 2>&1; then
  echo "Install Railway CLI: npm install -g @railway/cli && railway login && railway link"
  exit 1
fi

echo "Packaging Mac team client…"
bash "$ROOT/scripts/package-team-client.sh"

ZIP="$ROOT/server/public/downloads/EMAT-mac.zip"
if [[ ! -f "$ZIP" ]]; then
  echo "ERROR: Missing $ZIP after package"
  exit 1
fi

BYTES="$(wc -c <"$ZIP" | tr -d ' ')"
echo "Publishing $ZIP ($BYTES bytes) to Railway \${EMAT_DATA_DIR:-/data}/downloads/…"

# Stream zip into the running service volume.
if railway ssh -- bash -lc 'mkdir -p "${EMAT_DATA_DIR:-/data}/downloads" && cat > "${EMAT_DATA_DIR:-/data}/downloads/EMAT-mac.zip"' <"$ZIP"; then
  echo "Published."
  echo "Verify: open https://YOUR-APP.up.railway.app/join — Mac install should appear."
else
  echo "railway ssh upload failed."
  echo "Fallback: use Railway dashboard → service → shell, then upload the zip to \$EMAT_DATA_DIR/downloads/."
  exit 1
fi
