#!/usr/bin/env bash
# Boot the Skinalizer frontend dev server (proxies /api -> :8000).
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing frontend deps (first run)…"
  npm install
fi

exec npm run dev
