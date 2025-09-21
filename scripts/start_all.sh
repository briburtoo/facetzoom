#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.pids"
LOG_DIR="$ROOT/.logs"
mkdir -p "$PID_DIR" "$LOG_DIR"

SERVER_LOG="$LOG_DIR/server.log"
WEB_LOG="$LOG_DIR/web.log"
SERVER_PID_FILE="$PID_DIR/server.pid"
WEB_PID_FILE="$PID_DIR/web.pid"

# Stop anything that may already be running
if [[ -x "$ROOT/scripts/stop_all.sh" ]]; then
  "$ROOT/scripts/stop_all.sh" || true
fi

echo "Starting FacetZoom server..."
node "$ROOT/packages/server/dist/server.js" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$SERVER_PID_FILE"
echo "  PID: $SERVER_PID (logs: $SERVER_LOG)"

sleep 1

echo "Starting FacetZoom web dev server..."
npm run dev --workspace @facetzoom/web-app -- --host 0.0.0.0 >"$WEB_LOG" 2>&1 &
WEB_PID=$!
echo "$WEB_PID" > "$WEB_PID_FILE"
echo "  PID: $WEB_PID (logs: $WEB_LOG)"

echo "All services started. Tail logs with:\n  tail -f $SERVER_LOG $WEB_LOG"
