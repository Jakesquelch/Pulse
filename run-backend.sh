#!/usr/bin/env bash
# Run the Pulse API on http://localhost:8000
set -euo pipefail

cd "$(dirname "$0")/backend"

# Bail out early if the API is already up
if curl -sf -o /dev/null --max-time 2 http://localhost:8000/tasks; then
  echo "API is already running at http://localhost:8000"
  exit 0
fi

# Windows venvs put executables in Scripts/, mac and linux in bin/
if [ -d .venv/bin ]; then
  VENV_BIN=.venv/bin
else
  VENV_BIN=.venv/Scripts
fi

# Create the venv on a fresh checkout
if [ ! -d .venv ]; then
  echo "Creating virtual environment..."
  python -m venv .venv
fi

# Install only when needed: fresh venv or requirements changed. The stamp file
# records when the last install happened, since pip doesn't touch .venv itself.
STAMP=.venv/.requirements-installed
if [ ! -f "$STAMP" ] || [ requirements.txt -nt "$STAMP" ]; then
  echo "Installing dependencies..."
  "$VENV_BIN/python" -m pip install -r requirements.txt
  touch "$STAMP"
fi

# A venv bakes its own absolute path into activate, so renaming or moving the
# project silently breaks `source .venv/Scripts/activate` — the prompt still
# says (.venv) but pip and uvicorn vanish from PATH. Calling the venv's python
# directly sidesteps that entirely, but warn so manual activation isn't a
# mystery later.
if command -v cygpath >/dev/null 2>&1; then
  EXPECTED_VENV=$(cygpath -w "$PWD/.venv")   # activate stores C:\... on Windows
else
  EXPECTED_VENV="$PWD/.venv"
fi
if ! grep -qF "$EXPECTED_VENV" "$VENV_BIN/activate"; then
  echo "Note: this venv was created at a different path, so 'source $VENV_BIN/activate'"
  echo "      will not work. This script is unaffected. To repair it:"
  echo "      rm -rf .venv && ./run-backend.sh"
fi

exec "$VENV_BIN/python" -m uvicorn main:app --reload
