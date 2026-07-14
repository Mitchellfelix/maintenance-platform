#!/usr/bin/env bash
# Package the Mac team client and publish EMAT-mac.zip onto the Railway volume
# so https://YOUR-APP/install-mac and /downloads/EMAT-ready.zip work in the cloud.
#
# Prerequisites:
#   - railway CLI linked to the web service
#   - Volume mounted at /data with EMAT_DATA_DIR=/data on the service
#   - SSH key registered: railway ssh keys add
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
echo "Publishing $ZIP ($BYTES bytes) to Railway volume /downloads/…"

VOL="${RAILWAY_VOLUME:-emat-volume}"
IDENTITY="${RAILWAY_SSH_IDENTITY:-$HOME/.ssh/id_ecdsa}"

upload_ok=0
if railway volume files -v "$VOL" upload "$ZIP" /downloads/EMAT-mac.zip --overwrite 2>/tmp/emat-vol-upload.err; then
  upload_ok=1
elif [[ -f "$IDENTITY" ]] && railway ssh -i "$IDENTITY" -- bash -lc 'mkdir -p "${EMAT_DATA_DIR:-/data}/downloads" && cat > "${EMAT_DATA_DIR:-/data}/downloads/EMAT-mac.zip"' <"$ZIP"; then
  upload_ok=1
elif railway ssh -- bash -lc 'mkdir -p "${EMAT_DATA_DIR:-/data}/downloads" && cat > "${EMAT_DATA_DIR:-/data}/downloads/EMAT-mac.zip"' <"$ZIP"; then
  upload_ok=1
fi

if [[ "$upload_ok" -eq 1 ]]; then
  echo "Published."
  echo "Verify: open your Railway Join URL — Mac install should appear."
  exit 0
fi

echo "Upload failed."
cat /tmp/emat-vol-upload.err 2>/dev/null || true
echo "Register an SSH key if needed: railway ssh keys add"
echo "Then re-run: npm run railway:publish-mac"
exit 1
