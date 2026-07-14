#!/bin/bash
# Remove the EMAT team-server LaunchAgent.
set -euo pipefail

LABEL="com.emat.team-server"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
rm -f "$PLIST"

echo "Removed autostart for ${LABEL}."
echo "To stop the stack: docker compose --profile team down"
