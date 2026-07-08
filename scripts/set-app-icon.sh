#!/bin/bash
# Build a macOS .icns icon from the project SVG and apply it to Maintenance Platform.app
#
# Usage:
#   ./scripts/set-app-icon.sh
#   ./scripts/set-app-icon.sh ~/Desktop/Maintenance\ Platform.app

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVG="$ROOT/client/public/icons/icon.svg"
APP_PATH="${1:-$HOME/Desktop/Maintenance Platform.app}"
WORK_DIR="$(mktemp -d)"
ICONSET="$WORK_DIR/AppIcon.iconset"
SOURCE_PNG="$WORK_DIR/icon-1024.png"

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

if [[ ! -f "$SVG" ]]; then
  echo "Error: Icon source not found at $SVG"
  exit 1
fi

if [[ ! -d "$APP_PATH" ]]; then
  echo "Error: App not found at $APP_PATH"
  echo "Run ./scripts/create-desktop-app.sh first."
  exit 1
fi

echo "Rendering icon from SVG..."
qlmanage -t -s 1024 -o "$WORK_DIR" "$SVG" >/dev/null 2>&1

# qlmanage names output: icon.svg.png
if [[ -f "$WORK_DIR/icon.svg.png" ]]; then
  mv "$WORK_DIR/icon.svg.png" "$SOURCE_PNG"
else
  # fallback naming
  RENDERED="$(find "$WORK_DIR" -maxdepth 1 -name '*.png' | head -1)"
  [[ -n "$RENDERED" ]] || { echo "Error: Could not render SVG to PNG."; exit 1; }
  mv "$RENDERED" "$SOURCE_PNG"
fi

mkdir -p "$ICONSET"

make_icon() {
  local size=$1
  local name=$2
  sips -z "$size" "$size" "$SOURCE_PNG" --out "$ICONSET/$name" >/dev/null
}

make_icon 16  icon_16x16.png
make_icon 32  icon_16x16@2x.png
make_icon 32  icon_32x32.png
make_icon 64  icon_32x32@2x.png
make_icon 128 icon_128x128.png
make_icon 256 icon_128x128@2x.png
make_icon 256 icon_256x256.png
make_icon 512 icon_256x256@2x.png
make_icon 512 icon_512x512.png
cp "$SOURCE_PNG" "$ICONSET/icon_512x512@2x.png"

iconutil -c icns "$ICONSET" -o "$WORK_DIR/AppIcon.icns"

mkdir -p "$APP_PATH/Contents/Resources"
cp "$WORK_DIR/AppIcon.icns" "$APP_PATH/Contents/Resources/AppIcon.icns"

# Refresh Finder icon cache for this app
touch "$APP_PATH"
xattr -cr "$APP_PATH" 2>/dev/null || true

echo "Applied icon to: $APP_PATH"
echo ""
echo "If the icon still looks generic in Finder:"
echo "  1. Right-click the app → Get Info — the new icon should appear top-left"
echo "  2. If it still looks wrong, run: killall Finder"
