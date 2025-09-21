#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.pids"
SERVER_PID_FILE="$PID_DIR/server.pid"
WEB_PID_FILE="$PID_DIR/web.pid"

stop_pid() {
  local pid_file="$1"
  local label="$2"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping $label (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

stop_pid "$WEB_PID_FILE" "web app"
stop_pid "$SERVER_PID_FILE" "server"

echo "All recorded processes stopped."
