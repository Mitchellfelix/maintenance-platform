#!/bin/bash
# Clears macOS Gatekeeper quarantine on the team app (needed for unsigned LAN downloads).
set -euo pipefail
cd "$(dirname "$0")"
APP="EMAT Tracking Database.app"
if [[ ! -d "$APP" ]]; then
  osascript -e 'display alert "EMAT" message "Keep this script next to “EMAT Tracking Database.app”, then run it again." as critical'
  exit 1
fi
xattr -cr "$APP" 2>/dev/null || true
open "$APP"
exit 0
