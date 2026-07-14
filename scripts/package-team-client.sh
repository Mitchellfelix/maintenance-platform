#!/bin/bash
# Package the thin Mac team client and publish it for /downloads.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_DIR="$ROOT/electron"
OUT_DIR="$ROOT/dist/team-client"
DOWNLOADS="$ROOT/server/public/downloads"
TARGET_ZIP="$DOWNLOADS/EMAT-mac.zip"
APP_NAME="EMAT Tracking Database.app"
FIX_SCRIPT="$ELECTRON_DIR/Fix & Open.command"

cd "$ELECTRON_DIR"

if [[ ! -d node_modules/electron-builder ]]; then
  echo "Installing team-client packaging dependencies..."
  npm install
fi

echo "Packaging Mac team client..."
npm run pack

mkdir -p "$DOWNLOADS"

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

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/emat-team-pack.XXXXXX")"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

echo "Staging app (ad-hoc sign + Fix & Open helper)..."
ditto -x -k "$SOURCE_ZIP" "$STAGE"
APP_PATH="$STAGE/$APP_NAME"
if [[ ! -d "$APP_PATH" ]]; then
  echo "Packaging failed: $APP_NAME missing after unzip"
  find "$STAGE" -maxdepth 2 -print
  exit 1
fi

codesign --force --deep --sign - "$APP_PATH" >/dev/null 2>&1 || true

chmod +x "$FIX_SCRIPT"
cp "$FIX_SCRIPT" "$STAGE/Fix & Open.command"
chmod +x "$STAGE/Fix & Open.command"

rm -f "$TARGET_ZIP"
(
  cd "$STAGE"
  zip -ry "$TARGET_ZIP" "$APP_NAME" "Fix & Open.command"
)

echo ""
echo "Published: $TARGET_ZIP"
echo "If macOS says damaged: double-click “Fix & Open.command” after unzip."
echo "Join page: http://<host>:3000/join"
