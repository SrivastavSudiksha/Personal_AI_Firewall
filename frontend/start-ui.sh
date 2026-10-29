#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ ! -d node_modules/next ]; then
  echo "Installing frontend deps..."
  npm install --no-audit --no-fund
fi
echo "Shihezu UI on :3000"
exec npm run dev -- --hostname 0.0.0.0 --port 3000
