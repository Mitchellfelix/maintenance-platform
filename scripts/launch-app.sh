#!/bin/bash
# Start EMAT stack and open in the default browser (legacy launcher).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${EMAT_PORT:-3000}"

"$ROOT/scripts/start-stack.sh"
open "http://localhost:${PORT}"
