#!/usr/bin/env bash
# Restore EMAT PostgreSQL from a gzipped SQL backup.
# REQUIRES explicit confirmation — this replaces live data.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${EMAT_BACKUP_DIR:-$ROOT/backups}"

usage() {
  echo "Usage: $0 <backup.sql.gz>"
  echo "       $0 --latest"
  echo ""
  echo "Available backups:"
  ls -1t "$BACKUP_DIR"/emat-*.sql.gz 2>/dev/null || echo "  (none — run npm run db:backup first)"
  exit 1
}

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  usage
fi

if [[ "$FILE" == "--latest" ]]; then
  FILE="$(ls -1t "$BACKUP_DIR"/emat-*.sql.gz 2>/dev/null | head -1 || true)"
  if [[ -z "$FILE" ]]; then
    echo "ERROR: No backups found in $BACKUP_DIR" >&2
    exit 1
  fi
fi

if [[ ! -f "$FILE" ]]; then
  echo "ERROR: File not found: $FILE" >&2
  exit 1
fi

if [[ "${EMAT_CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo "This will REPLACE all data in maintenance_platform with:"
  echo "  $FILE"
  echo ""
  echo "A safety backup of the current DB will be taken first."
  echo "To proceed, re-run with:"
  echo "  EMAT_CONFIRM_RESTORE=YES $0 \"$FILE\""
  exit 1
fi

echo "Taking a safety backup of the current database first..."
bash "$ROOT/scripts/backup-db.sh" >/dev/null

echo "Restoring $FILE ..."
if (cd "$ROOT" && docker compose exec -T db pg_isready -U maintenance -d maintenance_platform >/dev/null 2>&1); then
  gunzip -c "$FILE" | (cd "$ROOT" && docker compose exec -T db psql -U maintenance -d maintenance_platform -v ON_ERROR_STOP=1)
else
  echo "ERROR: Docker Postgres is not ready. Start it with: docker compose up -d db" >&2
  exit 1
fi

echo "Restore complete. Restart the app if it was running."
