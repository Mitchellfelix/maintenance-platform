#!/bin/bash
# Launch EMAT in its own desktop window (Electron).
set -euo pipefail

LIB="$(cd "$(dirname "$0")/lib" && pwd)"
# shellcheck source=lib/emat-home.sh
source "$LIB/emat-home.sh"

ROOT="$(emat_require_home)"
cd "$ROOT"

for dir in /opt/homebrew/bin /usr/local/bin "$HOME/.nvm/versions/node/"*/bin; do
  if [[ -x "$dir/node" ]]; then
    export PATH="$dir:$PATH"
    break
  fi
done

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "EMAT Tracking Database" message "Node.js was not found. Run npm install from the project folder first." as critical' 2>/dev/null || true
  exit 1
fi

if [[ ! -x "$ROOT/node_modules/.bin/electron" ]]; then
  osascript -e 'display alert "EMAT Tracking Database" message "Electron is not installed. Run npm install in the project folder first." as critical' 2>/dev/null || true
  exit 1
fi

exec "$ROOT/node_modules/.bin/electron" "$ROOT/electron/main.js"
