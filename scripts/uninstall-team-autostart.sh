#!/bin/bash
# Remove the EMAT KeepAlive LaunchAgent and stop the listener.
set -euo pipefail

LABEL="com.emat.team-server"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
rm -f "$PLIST"

lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null | while read -r pid; do
  kill "$pid" 2>/dev/null || true
done

echo "Removed autostart (${LABEL}) and stopped port 3000."
