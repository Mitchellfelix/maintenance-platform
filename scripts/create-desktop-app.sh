#!/bin/bash
# Create a macOS .app that launches EMAT Tracking Database from the Dock.
#
# Usage:
#   ./scripts/create-desktop-app.sh
#   ./scripts/create-desktop-app.sh ~/Desktop
#   ./scripts/create-desktop-app.sh /Applications
#
# After creating:
#   ./scripts/set-app-icon.sh "/Applications/EMAT Tracking Database.app"
#   Drag the app to your Dock.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="EMAT Tracking Database"
INSTALL_DIR="${1:-$ROOT/apps}"
APP_PATH="$INSTALL_DIR/${APP_NAME}.app"
BUNDLE_ID="com.emat.tracking-database"
EXEC_NAME="emat-launcher"

mkdir -p "$APP_PATH/Contents/MacOS"
mkdir -p "$APP_PATH/Contents/Resources"

cat >"$APP_PATH/Contents/MacOS/$EXEC_NAME" <<'EOF'
#!/bin/bash
export EMAT_PORT=3000
MARKER="$HOME/.emat/home"
if [[ ! -f "$MARKER" ]]; then
  osascript -e 'display alert "EMAT Tracking Database" message "Run npm run app:install once from the project folder to set up the Dock app." as critical' 2>/dev/null || true
  exit 1
fi
ROOT="$(tr -d '[:space:]' <"$MARKER")"
exec "$ROOT/scripts/run-desktop.sh"
EOF
chmod +x "$APP_PATH/Contents/MacOS/$EXEC_NAME"

cat >"$APP_PATH/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>${APP_NAME}</string>
  <key>CFBundleExecutable</key>
  <string>${EXEC_NAME}</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>${BUNDLE_ID}</string>
  <key>CFBundleName</key>
  <string>${APP_NAME}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
</dict>
</plist>
EOF

if [[ -x "$ROOT/scripts/set-app-icon.sh" ]]; then
  "$ROOT/scripts/set-app-icon.sh" "$APP_PATH" || true
fi

echo "Created: $APP_PATH"
echo ""
echo "Run once from the project folder to register PATH + this app:"
echo "  npm run app:install"
echo ""
echo "Then launch from anywhere:"
echo "  emat"
echo "  (or open from /Applications or the Dock)"
