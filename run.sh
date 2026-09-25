#!/usr/bin/env bash
# ==========================================================================
# run.sh — macOS/Linux launcher for the Sir Vishveshwaraiah Conference Hall
# Booking System.
#
# Why this exists: the app uses JavaScript ES modules (import/export),
# which browsers block from loading over a plain double-clicked file://
# path (CORS). It has to be served over http://localhost instead. This
# script starts the simplest possible local server and opens the app.
#
# Prerequisite: Python 3 (usually already installed on macOS/Linux).
# ==========================================================================

set -e
cd "$(dirname "$0")"

PORT=8000
URL="http://localhost:$PORT/index.html"

if command -v python3 >/dev/null 2>&1; then
  PYCMD=python3
elif command -v python >/dev/null 2>&1; then
  PYCMD=python
else
  echo "Python 3 was not found. Install it (e.g. 'brew install python3' on macOS,"
  echo "or your distro's package manager on Linux), then run this script again."
  exit 1
fi

echo "Starting local server at $URL ..."

# Open the browser shortly after the server comes up (works on macOS and
# most Linux desktops; harmless if it fails — just open the URL by hand).
( sleep 1
  if command -v open >/dev/null 2>&1; then open "$URL";          # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"; # Linux
  fi
) &

"$PYCMD" -m http.server "$PORT"
