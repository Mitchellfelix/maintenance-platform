#!/usr/bin/env bash
# Backup then apply Prisma migrations (never wipe). Prefer this over raw prisma commands.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Safety backup before migrate..."
if ! bash "$ROOT/scripts/backup-db.sh"; then
  if [[ "${EMAT_ALLOW_MIGRATE_WITHOUT_BACKUP:-}" == "1" ]]; then
    echo "WARNING: Backup failed; continuing because EMAT_ALLOW_MIGRATE_WITHOUT_BACKUP=1" >&2
  else
    echo "ERROR: Backup failed. Fix DB/Docker, or set EMAT_ALLOW_MIGRATE_WITHOUT_BACKUP=1 only if intentional." >&2
    exit 1
  fi
fi

echo "→ Applying migrations (prisma migrate deploy)..."
(cd "$ROOT" && npm run db:deploy --workspace server)

echo "Migrations applied."
