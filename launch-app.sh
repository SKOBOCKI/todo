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

URL=""
for port in 3000 3001 3002 3003 3004 3005; do
  if curl -sSf "http://127.0.0.1:${port}/index.html" >/dev/null 2>&1; then
    URL="http://127.0.0.1:${port}"
    break
  fi
done

if [[ -z "$URL" ]]; then
  URL="http://127.0.0.1:3000"
fi

if command -v chromium >/dev/null 2>&1; then
  chromium --app="$URL" --class=Notite --user-data-dir="/tmp/notite-profile" --no-sandbox --disable-dev-shm-usage "$URL" >/dev/null 2>&1 &
elif command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser --app="$URL" --class=Notite --user-data-dir="/tmp/notite-profile" --no-sandbox --disable-dev-shm-usage "$URL" >/dev/null 2>&1 &
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
elif command -v gio >/dev/null 2>&1; then
  gio open "$URL" >/dev/null 2>&1 || true
elif command -v python3 >/dev/null 2>&1; then
  python3 -m webbrowser "$URL" >/dev/null 2>&1 || true
fi

echo "Deschide aplicația la $URL"
echo "Serverul rulează în fundal. Apasă Ctrl+C pentru a-l opri."
wait "$SERVER_PID"
