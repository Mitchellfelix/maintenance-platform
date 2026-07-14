#!/usr/bin/env bash
# Migrate local EMAT Postgres (+ optional uploads) to Railway Postgres.
#
# Prerequisites:
#   - Local Docker Postgres running with your current data
#   - railway CLI logged in and linked to the project (`railway link`)
#   - Postgres plugin attached (DATABASE_URL available via `railway variables`)
#
# Usage:
#   npm run railway:migrate
#   EMAT_MIGRATE_UPLOADS=1 npm run railway:migrate   # also copy greentag photos
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v railway >/dev/null 2>&1; then
  echo "Install the Railway CLI first:"
  echo "  npm install -g @railway/cli"
  echo "  railway login"
  echo "  railway link"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required on this Mac (Postgres client)."
  echo "  brew install libpq && brew link --force libpq"
  exit 1
fi

echo "=== 1) Backup local database ==="
BACKUP_OUT="$(bash "$ROOT/scripts/backup-db.sh" | tail -1)"
if [[ ! -f "$BACKUP_OUT" ]]; then
  echo "ERROR: Backup failed"
  exit 1
fi
echo "Local backup: $BACKUP_OUT"

echo ""
echo "=== 2) Resolve Railway DATABASE_URL ==="
# Prefer explicitly provided URL (safer for scripting).
RAILWAY_DB_URL="${RAILWAY_DATABASE_URL:-${DATABASE_URL_RAILWAY:-}}"
if [[ -z "$RAILWAY_DB_URL" ]]; then
  # railway variables --json works on recent CLI; fall back to plain text.
  if railway variables --json >/tmp/emat-railway-vars.json 2>/dev/null; then
    RAILWAY_DB_URL="$(node -e "const j=require('/tmp/emat-railway-vars.json'); const v=j.DATABASE_URL||j.database_url||''; if(!v) process.exit(2); process.stdout.write(v)")" || true
  fi
fi
if [[ -z "$RAILWAY_DB_URL" ]]; then
  RAILWAY_DB_URL="$(railway variables 2>/dev/null | awk -F'│' '/DATABASE_URL/{gsub(/^ +| +$/,"",$2); print $2; exit}' || true)"
fi
if [[ -z "$RAILWAY_DB_URL" ]]; then
  echo "Could not read DATABASE_URL from Railway."
  echo "Set it explicitly:"
  echo "  RAILWAY_DATABASE_URL='postgresql://...' npm run railway:migrate"
  exit 1
fi

# Never print full credentials
echo "Railway DATABASE_URL: ${RAILWAY_DB_URL%%@*}@…"

echo ""
echo "=== 3) Confirm restore (DESTROYS current Railway DB contents) ==="
if [[ "${EMAT_CONFIRM_MIGRATE:-}" != "YES" ]]; then
  echo "This replaces ALL data on Railway with your local dump."
  echo "Re-run with:"
  echo "  EMAT_CONFIRM_MIGRATE=YES npm run railway:migrate"
  exit 1
fi

echo "Restoring into Railway…"
# Strip ownership noise; stop on SQL errors.
gunzip -c "$BACKUP_OUT" | psql "$RAILWAY_DB_URL" -v ON_ERROR_STOP=1

echo ""
echo "=== 4) Optional uploads ==="
if [[ "${EMAT_MIGRATE_UPLOADS:-}" == "1" ]]; then
  LOCAL_UPLOADS="$ROOT/server/uploads"
  if [[ ! -d "$LOCAL_UPLOADS" ]] || [[ -z "$(find "$LOCAL_UPLOADS" -type f ! -name '.gitkeep' 2>/dev/null | head -1)" ]]; then
    echo "No local upload files to copy."
  else
    STAGE="$(mktemp -d "${TMPDIR:-/tmp}/emat-uploads.XXXXXX")"
    trap 'rm -rf "$STAGE"' EXIT
    tar -C "$LOCAL_UPLOADS" -czf "$STAGE/uploads.tgz" .
    echo "Uploads archive: $STAGE/uploads.tgz"
    echo "Copying into Railway volume via railway ssh…"
    if railway ssh -- bash -lc 'mkdir -p "${EMAT_DATA_DIR:-/data}/uploads" && tar -xzf - -C "${EMAT_DATA_DIR:-/data}/uploads"' <"$STAGE/uploads.tgz"; then
      echo "Uploads migrated."
    else
      echo "WARN: Could not push uploads via railway ssh."
      echo "Manual: npm run railway:publish-uploads"
    fi
  fi
else
  echo "Skipped uploads (set EMAT_MIGRATE_UPLOADS=1 to include greentag photos)."
fi

echo ""
echo "Migration complete."
echo "Open your Railway public URL /join and sign in with an existing account."
echo "Then publish the Mac app zip: npm run railway:publish-mac"
