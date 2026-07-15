#!/bin/bash
# Run EMAT as a shared team server (Docker: Postgres + API + UI on port 3000).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${EMAT_PORT:-3000}"
DOWNLOAD_ZIP="$ROOT/server/public/downloads/EMAT-mac.zip"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop and try again."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop and try again."
  exit 1
fi

if [[ ! -f server/.env ]]; then
  cp server/.env.example server/.env
  echo "Created server/.env — set a strong JWT_SECRET before production use."
fi

# team profile reads JWT_SECRET from server/.env (not host env interpolation).
if ! grep -Eq '^[[:space:]]*JWT_SECRET[[:space:]]*=[[:space:]]*.+' server/.env; then
  echo "Set JWT_SECRET in server/.env (32+ random chars) before starting the team server."
  exit 1
fi

if [[ ! -f "$DOWNLOAD_ZIP" ]]; then
  echo "Mac team app zip not found — packaging now (one-time)..."
  if ! bash "$ROOT/scripts/package-team-client.sh"; then
    echo "WARNING: Could not package Mac download. Browser join will still work."
  fi
fi

echo "Building and starting team server..."
if bash "$ROOT/scripts/backup-db.sh"; then
  echo "Pre-start backup OK."
else
  echo "WARNING: Could not back up before start (DB may be empty/first run)."
fi

docker compose --profile team up -d --build

echo "Waiting for EMAT to become ready..."
tries=0
while (( tries < 90 )); do
  if curl -fsS "http://localhost:${PORT}/api/health/db" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  tries=$((tries + 1))
done

if ! curl -fsS "http://localhost:${PORT}/api/health/db" >/dev/null 2>&1; then
  echo "Server did not become ready. Check: docker compose logs app"
  exit 1
fi

detect_lan_ip() {
  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
  else
    hostname -I 2>/dev/null | awk '{print $1}' || true
  fi
}

LAN_IP="$(detect_lan_ip)"
LOCAL_URL="http://localhost:${PORT}"
TEAM_URL="$LOCAL_URL"
if [[ -n "$LAN_IP" ]]; then
  TEAM_URL="http://${LAN_IP}:${PORT}"
fi
JOIN_URL="${TEAM_URL}/join"

echo ""
echo "=============================================="
echo " EMAT team server is running"
echo "=============================================="
echo ""
echo "  Send your team this Join link:"
echo "    ${JOIN_URL}"
echo ""
echo "  Browser app:     ${TEAM_URL}"
echo "  Local (host):    ${LOCAL_URL}"
if [[ -f "$DOWNLOAD_ZIP" ]]; then
  echo "  Mac download:    ${TEAM_URL}/downloads/EMAT-mac.zip"
else
  echo "  Mac download:    missing — run: npm run package:team-client"
fi
echo ""
echo "  Teammates: open the Join link → Download for Mac (or use browser)."
echo "  No git / Node / Docker needed on teammate Macs."
echo ""
echo "  Logs:  docker compose logs -f app"
echo "  Stop:  docker compose --profile team down"
echo "  NEVER use: docker compose down -v  (that deletes your database volume)"
echo "  Backup: npm run db:backup"
echo ""
echo "  Advanced (developers): npm run team:connect -- ${TEAM_URL}"
