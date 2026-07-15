#!/bin/bash
# Install a KeepAlive LaunchAgent so EMAT stays online (restarts if the process dies).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.emat.team-server"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
RUNNER="$ROOT/scripts/team-server-run.sh"
LOG_DIR="${HOME}/Library/Logs/EMAT"
NODE_BIN="${HOME}/.nvm/versions/node/v22.22.3/bin/node"

# Refuse when this Mac is pointed at Railway / a remote team host — that would
# fight the remote server by KeepAlive-binding local :3000.
if [[ -f "$ROOT/server/.env" ]]; then
  remote_url="$(grep -E '^EMAT_APP_URL=' "$ROOT/server/.env" | tail -1 || true)"
  remote_url="${remote_url#EMAT_APP_URL=}"
  remote_url="${remote_url%\"}"
  remote_url="${remote_url#\"}"
  remote_url="${remote_url%\'}"
  remote_url="${remote_url#\'}"
  if [[ -n "$remote_url" ]] \
    && [[ ! "$remote_url" =~ ^https?://localhost([:/]|$) ]] \
    && [[ ! "$remote_url" =~ ^https?://127\.0\.0\.1([:/]|$) ]]; then
    echo "Refusing local team autostart: EMAT_APP_URL is set to $remote_url"
    echo "Railway/team mode should not bind port 3000 on this Mac."
    echo "To host locally again, remove EMAT_APP_URL from server/.env first."
    exit 1
  fi
fi

chmod +x "$RUNNER" "$ROOT/scripts/team-keep-alive.sh" 2>/dev/null || true
mkdir -p "${HOME}/Library/LaunchAgents" "$LOG_DIR"

# Allow Node through the macOS application firewall (needs privileges sometimes).
if [[ -x "$NODE_BIN" ]]; then
  /usr/libexec/ApplicationFirewall/socketfilterfw --add "$NODE_BIN" 2>/dev/null || true
  /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$NODE_BIN" 2>/dev/null || true
fi

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
      <string>${RUNNER}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>5</integer>
    <key>WorkingDirectory</key>
    <string>${ROOT}</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>${HOME}/.nvm/versions/node/v22.22.3/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
      <key>EMAT_PORT</key>
      <string>3000</string>
      <key>HOST</key>
      <string>0.0.0.0</string>
    </dict>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchagent.out.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchagent.err.log</string>
  </dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
# Stop any manual npm/node on 3000 so KeepAlive owns the port.
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null | while read -r pid; do
    kill "$pid" 2>/dev/null || true
  done || true
  sleep 1
fi

if ! launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/tmp/emat-launchctl-bootstrap.err; then
  echo "launchctl bootstrap failed:"
  cat /tmp/emat-launchctl-bootstrap.err 2>/dev/null || true
  # Last resort: load via legacy API
  launchctl load -w "$PLIST" 2>/dev/null || true
fi
launchctl enable "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl kickstart -k "gui/$(id -u)/${LABEL}" 2>/dev/null || launchctl start "$LABEL" 2>/dev/null || true

echo ""
echo "Installed KeepAlive agent: $PLIST"
echo "EMAT will stay running and auto-restart if it crashes."
echo ""
echo "Do these once so teammates can reach you:"
echo "  1. System Settings → Network → Firewall → Options"
echo "     → turn OFF “Enable stealth mode” (stealth makes LAN connects time out)"
echo "     → allow incoming for Node if prompted"
echo "  2. Docker Desktop → start at login (needed for the database)"
echo "  3. Energy → prevent sleep while plugged in"
echo ""
echo "Share:  http://$(ipconfig getifaddr en0 2>/dev/null || echo YOUR-IP):3000/join"
echo "Logs:   $LOG_DIR/team-server.log"
echo "Stop:   npm run team:autostart:off"
echo ""
