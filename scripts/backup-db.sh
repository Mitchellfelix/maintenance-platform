#!/usr/bin/env bash
# Snapshot the live EMAT PostgreSQL database into backups/.
# Safe to run anytime — does not modify data.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${EMAT_BACKUP_DIR:-$ROOT/backups}"
KEEP="${EMAT_BACKUP_KEEP:-40}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/emat-${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

dump_via_docker() {
  (cd "$ROOT" && docker compose exec -T db pg_isready -U maintenance -d maintenance_platform >/dev/null 2>&1) || return 1
  (cd "$ROOT" && docker compose exec -T db \
    pg_dump -U maintenance -d maintenance_platform --clean --if-exists --no-owner --no-acl) \
    | gzip -c >"$OUT"
}

dump_via_url() {
  local url="${DATABASE_URL:-}"
  if [[ -z "$url" && -f "$ROOT/server/.env" ]]; then
    # shellcheck disable=SC1091
    set -a
    # Only pull DATABASE_URL — avoid sourcing secrets into shell history broadly.
    url="$(grep -E '^DATABASE_URL=' "$ROOT/server/.env" | tail -1 | cut -d= -f2-)"
    url="${url%\"}"
    url="${url#\"}"
    url="${url%\'}"
    url="${url#\'}"
    set +a
  fi
  if [[ -z "$url" ]]; then
    return 1
  fi
  if ! command -v pg_dump >/dev/null 2>&1; then
    return 1
  fi
  pg_dump "$url" --clean --if-exists --no-owner --no-acl | gzip -c >"$OUT"
}

if dump_via_docker; then
  :
elif dump_via_url; then
  :
else
  echo "ERROR: Could not back up database. Is Docker Postgres running (docker compose up -d db)?" >&2
  rm -f "$OUT"
  exit 1
fi

# Drop empty / failed dumps
if [[ ! -s "$OUT" ]]; then
  echo "ERROR: Backup file is empty." >&2
  rm -f "$OUT"
  exit 1
fi

# Rotate old backups (keep newest KEEP)
# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/emat-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
done

BYTES="$(wc -c <"$OUT" | tr -d ' ')"
echo "Backup written: $OUT ($BYTES bytes)"
echo "$OUT"
