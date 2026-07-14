#!/usr/bin/env bash
# Print the Railway go-live checklist and verify local prerequisites.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/opt/homebrew/opt/libpq/bin:/usr/local/opt/libpq/bin:${PATH:-}"

echo "EMAT → Railway go-live checklist"
echo "================================"
echo ""
echo "Prereqs on this Mac:"
if command -v railway >/dev/null 2>&1; then
  echo "  [ok] railway CLI"
else
  echo "  [!!] install: npm install -g @railway/cli"
fi
if command -v psql >/dev/null 2>&1; then
  echo "  [ok] psql ($(psql --version | head -1))"
else
  echo "  [!!] install: brew install libpq && brew link --force libpq"
fi
if docker compose exec -T db pg_isready -U maintenance -d maintenance_platform >/dev/null 2>&1; then
  echo "  [ok] local Postgres (for migrate)"
else
  echo "  [!!] start local DB: docker compose up -d db"
fi
echo ""
echo "Dashboard steps (https://railway.app):"
echo "  1. New project → Deploy from GitHub → Mitchellfelix/maintenance-platform"
echo "  2. Add Postgres plugin; wait until DATABASE_URL appears on the web service"
echo "  3. Web service → Variables:"
echo "       JWT_SECRET=<strong random>"
echo "       EMAT_APP_URL=https://YOUR-APP.up.railway.app"
echo "       APP_URL=https://YOUR-APP.up.railway.app"
echo "       CORS_ORIGIN=true"
echo "       EMAT_DATA_DIR=/data"
echo "       HOST=0.0.0.0"
echo "  4. Web service → Volumes → mount at /data"
echo "  5. Settings → Networking → Generate domain"
echo "  6. Redeploy if variables/volume were added after first deploy"
echo ""
echo "Then on this Mac:"
echo "  railway login"
echo "  railway link"
echo "  EMAT_CONFIRM_MIGRATE=YES EMAT_MIGRATE_UPLOADS=1 npm run railway:migrate"
echo "  npm run railway:publish-mac"
echo "  curl -fsS https://YOUR-APP.up.railway.app/api/health/db"
echo ""
echo "Full guide: docs/RAILWAY.md"
