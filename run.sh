#!/usr/bin/env bash
# Run the Pulse dev server on http://localhost:4200
set -euo pipefail

cd "$(dirname "$0")/frontend"

# Bail out early if the dev server is already up
if curl -sf -o /dev/null --max-time 2 http://localhost:4200; then
  echo "Dev server is already running at http://localhost:4200"
  exit 0
fi

# Install only when needed: fresh checkout or dependencies changed
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  npm i 
fi

exec npm start
