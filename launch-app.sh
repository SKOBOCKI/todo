#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="${TMPDIR:-/tmp}/notes-app.log"
: > "$LOG_FILE"

node server.js >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in $(seq 1 20); do
  if grep -q "http://" "$LOG_FILE"; then
    break
  fi
  sleep 0.25
done

URL=$(grep -o 'http://[^[:space:]]*' "$LOG_FILE" | tail -1 || true)
if [[ -z "$URL" ]]; then
  URL="http://127.0.0.1:3000"
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
elif command -v gio >/dev/null 2>&1; then
  gio open "$URL" >/dev/null 2>&1 || true
elif command -v python3 >/dev/null 2>&1; then
  python3 -m webbrowser "$URL" >/dev/null 2>&1 || true
fi

echo "Deschide aplicația la $URL"
echo "Serverul rulează în fundal. Apasă Ctrl+C pentru a-l opri."
wait "$SERVER_PID"
