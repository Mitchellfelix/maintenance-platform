#!/bin/bash
# Install a macOS LaunchAgent so the EMAT team server starts at login and is re-checked every 2 minutes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.emat.team-server"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
KEEP_ALIVE="$ROOT/scripts/team-keep-alive.sh"
LOG_DIR="${HOME}/Library/Logs/EMAT"

chmod +x "$KEEP_ALIVE"
mkdir -p "${HOME}/Library/LaunchAgents" "$LOG_DIR"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>${KEEP_ALIVE}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StartInterval</key>
    <integer>120</integer>
    <key>WorkingDirectory</key>
    <string>${ROOT}</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>${HOME}/.nvm/versions/node/v22.22.3/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
      <key>EMAT_PORT</key>
      <string>3000</string>
    </dict>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchagent.out.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchagent.err.log</string>
  </dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl kickstart -k "gui/$(id -u)/${LABEL}" 2>/dev/null || launchctl start "$LABEL" 2>/dev/null || true

echo ""
echo "Installed: $PLIST"
echo "EMAT team server will start at login and re-check every 2 minutes."
echo ""
echo "Also do this once (important):"
echo "  1. Open Docker Desktop → Settings → General"
echo "     → enable “Start Docker Desktop when you sign in”"
echo "  2. System Settings → Energy (or Battery) → prevent sleep while plugged in"
echo "     (sleep can still drop Wi‑Fi for teammates even if Docker restarts later)"
echo ""
echo "Start now:  npm run team:serve"
echo "Logs:       ~/Library/Logs/EMAT/"
echo "Remove:     npm run team:autostart:off"
echo ""
