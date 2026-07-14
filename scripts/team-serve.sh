#!/bin/bash
# Run EMAT as a shared team server (Docker: Postgres + API + UI on port 3000).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${EMAT_PORT:-3000}"

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
  if curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  tries=$((tries + 1))
done

if ! curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
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
TEAM_URL="http://localhost:${PORT}"
if [[ -n "$LAN_IP" ]]; then
  TEAM_URL="http://${LAN_IP}:${PORT}"
fi

echo ""
echo "=============================================="
echo " EMAT team server is running"
echo "=============================================="
echo ""
echo "  Local:     http://localhost:${PORT}"
if [[ -n "$LAN_IP" ]]; then
  echo "  Team URL:  http://${LAN_IP}:${PORT}"
fi
echo ""
echo "  Share with team members (after git clone):"
echo "    npm run team:connect -- ${TEAM_URL}"
echo ""
echo "  Or send the Team URL for browser access."
echo "  Logs:  docker compose logs -f app"
echo "  Stop:  docker compose --profile team down"
echo "  NEVER use: docker compose down -v  (that deletes your database volume)"
echo "  Backup: npm run db:backup"
