#!/bin/sh
set -e

# Persistent volume layout (Railway): mount one volume at /data and set EMAT_DATA_DIR=/data
if [ -n "${EMAT_DATA_DIR:-}" ]; then
  export UPLOAD_ROOT="${UPLOAD_ROOT:-$EMAT_DATA_DIR/uploads}"
  export EMAT_DOWNLOADS_DIR="${EMAT_DOWNLOADS_DIR:-$EMAT_DATA_DIR/downloads}"
  mkdir -p "$UPLOAD_ROOT/greentagging" "$EMAT_DOWNLOADS_DIR"
  echo "EMAT data dir: $EMAT_DATA_DIR (uploads + downloads)"
fi

# Ensure default in-image dirs exist when no volume is attached yet.
mkdir -p /app/server/uploads/greentagging /app/server/public/downloads 2>/dev/null || true

npm run db:deploy --workspace server
exec npm start --workspace server
