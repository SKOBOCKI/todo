#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOCAL_ELECTRON="$SCRIPT_DIR/node_modules/.bin/electron"
ELECTRON_BIN=""

if [[ -x "$LOCAL_ELECTRON" && -f "$SCRIPT_DIR/node_modules/electron/path.txt" ]]; then
  ELECTRON_BIN="$LOCAL_ELECTRON"
else
  for candidate in /usr/lib/electron42/electron /usr/lib/electron39/electron electron; do
    if command -v "$candidate" >/dev/null 2>&1 || [[ -x "$candidate" ]]; then
      ELECTRON_BIN="$candidate"
      break
    fi
  done
fi

if [[ -z "$ELECTRON_BIN" ]]; then
  echo "Electron nu este instalat. Rulează: npm install sau instalează electron din sistem."
  exit 1
fi

unset ELECTRON_RUN_AS_NODE

exec "$ELECTRON_BIN" --no-sandbox "$SCRIPT_DIR"
