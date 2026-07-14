#!/usr/bin/env bash
# Copy local server/uploads onto the Railway volume.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_UPLOADS="$ROOT/server/uploads"

if ! command -v railway >/dev/null 2>&1; then
  echo "Install Railway CLI: npm install -g @railway/cli && railway login && railway link"
  exit 1
fi

if [[ ! -d "$LOCAL_UPLOADS" ]]; then
  echo "No local uploads directory."
  exit 0
fi

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/emat-uploads.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
tar -C "$LOCAL_UPLOADS" -czf "$STAGE/uploads.tgz" .

echo "Publishing uploads to Railway…"
railway ssh -- bash -lc 'mkdir -p "${EMAT_DATA_DIR:-/data}/uploads" && tar -xzf - -C "${EMAT_DATA_DIR:-/data}/uploads"' <"$STAGE/uploads.tgz"
echo "Done."
