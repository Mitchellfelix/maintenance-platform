#!/bin/bash
# One-time install: global `emat` command + /Applications Dock app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARKER_DIR="$HOME/.emat"
MARKER_FILE="$MARKER_DIR/home"
BIN_DIR="$HOME/.local/bin"
CLI_LINK="$BIN_DIR/emat"

mkdir -p "$MARKER_DIR"
printf '%s\n' "$ROOT" >"$MARKER_FILE"

for dir in /opt/homebrew/bin /usr/local/bin "$HOME/.nvm/versions/node/"*/bin; do
  if [[ -x "$dir/node" ]]; then
    export PATH="$dir:$PATH"
    break
  fi
done

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install Node 20+ first (brew install node)."
  exit 1
fi

echo "Installing dependencies..."
(cd "$ROOT" && npm install)

mkdir -p "$BIN_DIR"
ln -sf "$ROOT/scripts/emat" "$CLI_LINK"
chmod +x \
  "$ROOT/scripts/emat" \
  "$ROOT/scripts/install-app.sh" \
  "$ROOT/scripts/create-desktop-app.sh" \
  "$ROOT/scripts/set-app-icon.sh" \
  "$ROOT/scripts/run-desktop.sh" \
  "$ROOT/scripts/start-stack.sh" \
  "$ROOT/scripts/stop-app.sh" \
  "$ROOT/scripts/launch-app.sh"

ensure_path() {
  local line='export PATH="$HOME/.local/bin:$PATH"'
  for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
    if [[ -f "$rc" ]] && ! grep -qF '.local/bin' "$rc" 2>/dev/null; then
      echo "" >>"$rc"
      echo "# EMAT Tracking Database CLI" >>"$rc"
      echo "$line" >>"$rc"
      echo "Updated $rc"
    fi
  done
}

ensure_path

echo "Creating /Applications app..."
"$ROOT/scripts/create-desktop-app.sh" "/Applications"

echo ""
echo "Installed successfully."
echo ""
echo "  Project:  $ROOT"
echo "  Command:  emat          (open app from any terminal)"
echo "  Command:  emat stop     (stop background server)"
echo "  App:      /Applications/EMAT Tracking Database.app"
echo ""
echo "Next steps:"
echo "  1. Open a new terminal tab (or run: export PATH=\"\$HOME/.local/bin:\$PATH\")"
echo "  2. Type: emat"
echo "  3. Drag /Applications/EMAT Tracking Database.app to your Dock"
echo ""
echo "Each launch rebuilds the UI when needed and applies DB migrations."
