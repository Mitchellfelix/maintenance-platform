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

export PATH="/opt/homebrew/opt/libpq/bin:/usr/local/opt/libpq/bin:${PATH:-}"

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
  echo "  export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\""
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
echo "=== 3) Safety compare (refuse wiping a fuller Railway DB) ==="
COUNTS_JS="$ROOT/scripts/db-counts.js"
LOCAL_JSON="$(node "$COUNTS_JS" --local 2>/dev/null || echo '{"error":"unreachable"}')"
REMOTE_JSON="$(DATABASE_URL="$RAILWAY_DB_URL" node "$COUNTS_JS" 2>/dev/null || echo '{"error":"unreachable"}')"
echo "Local:   $LOCAL_JSON"
echo "Railway: $REMOTE_JSON"

LOCAL_JSON="$LOCAL_JSON" REMOTE_JSON="$REMOTE_JSON" EMAT_FORCE_MIGRATE_OVERWRITE="${EMAT_FORCE_MIGRATE_OVERWRITE:-}" node <<'NODE'
const local = JSON.parse(process.env.LOCAL_JSON || "{}");
const remote = JSON.parse(process.env.REMOTE_JSON || "{}");
if (local.error || remote.error) {
  if (process.env.EMAT_FORCE_MIGRATE_OVERWRITE === "YES") process.exit(0);
  console.error("Could not compare DB counts. Refusing migrate (set EMAT_FORCE_MIGRATE_OVERWRITE=YES to override).");
  process.exit(1);
}
const score = (j) => (j.users || 0) + (j.sites || 0) + (j.assets || 0) + (j.workOrders || 0);
const ls = score(local);
const rs = score(remote);
if (rs > ls && process.env.EMAT_FORCE_MIGRATE_OVERWRITE !== "YES") {
  console.error("");
  console.error(`Refusing migrate: Railway looks fuller (score ${rs}) than local (score ${ls}).`);
  console.error("Full migrate REPLACES all Railway data with the local dump — that destroys accounts/data.");
  console.error("");
  console.error("Prefer non-destructive account sync:");
  console.error("  npm run railway:sync-users");
  console.error("");
  console.error("Only if you truly intend to wipe Railway:");
  console.error("  EMAT_CONFIRM_MIGRATE=YES EMAT_FORCE_MIGRATE_OVERWRITE=YES npm run railway:migrate");
  process.exit(1);
}
NODE

echo ""
echo "=== 4) Confirm restore (DESTROYS current Railway DB contents) ==="
if [[ "${EMAT_CONFIRM_MIGRATE:-}" != "YES" ]]; then
  echo "This replaces ALL data on Railway with your local dump."
  echo "Re-run with:"
  echo "  EMAT_CONFIRM_MIGRATE=YES npm run railway:migrate"
  echo ""
  echo "If you only need accounts and must not wipe Railway data:"
  echo "  npm run railway:sync-users"
  exit 1
fi

echo "Restoring into Railway…"
# Strip ownership noise; stop on SQL errors.
gunzip -c "$BACKUP_OUT" | psql "$RAILWAY_DB_URL" -v ON_ERROR_STOP=1

echo ""
echo "=== 5) Optional uploads ==="
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
