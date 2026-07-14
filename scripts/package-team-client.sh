#!/bin/bash
# Package the thin Mac team client and publish it for /downloads.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_DIR="$ROOT/electron"
OUT_DIR="$ROOT/dist/team-client"
DOWNLOADS="$ROOT/server/public/downloads"
TARGET_ZIP="$DOWNLOADS/EMAT-mac.zip"

cd "$ELECTRON_DIR"

if [[ ! -d node_modules/electron-builder ]]; then
  echo "Installing team-client packaging dependencies..."
  npm install
fi

echo "Packaging Mac team client..."
npm run pack

mkdir -p "$DOWNLOADS"

# Prefer the named artifact, otherwise pick the newest zip from the output dir.
SOURCE_ZIP=""
if [[ -f "$OUT_DIR/EMAT-mac.zip" ]]; then
  SOURCE_ZIP="$OUT_DIR/EMAT-mac.zip"
else
  SOURCE_ZIP="$(ls -t "$OUT_DIR"/*.zip 2>/dev/null | head -1 || true)"
fi

if [[ -z "$SOURCE_ZIP" || ! -f "$SOURCE_ZIP" ]]; then
  echo "Packaging failed: no zip found in $OUT_DIR"
  ls -la "$OUT_DIR" || true
  exit 1
fi

cp "$SOURCE_ZIP" "$TARGET_ZIP"
echo ""
echo "Published: $TARGET_ZIP"
echo "Serve with team:serve — teammates download from /downloads/EMAT-mac.zip"
echo "Join page: http://<host>:3000/join"
