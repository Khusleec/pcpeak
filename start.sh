#!/usr/bin/env bash
# Rigup — one-command launcher (macOS / Linux)
# Usage:  ./start.sh           (base stack)
#         ./start.sh --full    (with observability)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install from https://nodejs.org/" >&2
  exit 1
fi

node "$ROOT/infra/scripts/start.js" "$@"
