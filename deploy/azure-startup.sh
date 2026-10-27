#!/usr/bin/env bash
set -euo pipefail

# Azure App Service Linux Python 3.12 image; application sources are unchanged.
APP_ROOT=/home/site/wwwroot
RUNTIME_ROOT=/home/offball-runtime
VENV="$RUNTIME_ROOT/venv-maf"
NODE="$APP_ROOT/deploy/runtime/node"
cd "$APP_ROOT"

python3 -c 'import sys; assert sys.version_info[:2] == (3, 12), sys.version'
mkdir -p "$RUNTIME_ROOT"
LOCK_HASH="$(sha256sum requirements-agent.lock | cut -d ' ' -f 1)"
PYTHON_ID="$(python3 -c 'import sys; print(sys.version.split()[0])')"
EXPECTED="$LOCK_HASH $PYTHON_ID"
if [[ ! -x "$VENV/bin/python" ]] || [[ ! -f "$RUNTIME_ROOT/installed.lock" ]] || [[ "$(cat "$RUNTIME_ROOT/installed.lock")" != "$EXPECTED" ]]; then
  python3 -m venv --copies "$VENV"
  "$VENV/bin/python" -m pip install --disable-pip-version-check --no-cache-dir -r requirements-agent.lock
  "$VENV/bin/python" -m pip check
  printf '%s\n' "$EXPECTED" > "$RUNTIME_ROOT/installed.lock"
fi

chmod +x "$NODE"
"$NODE" --version
"$VENV/bin/python" --version
export MAF_PYTHON="$VENV/bin/python"
export HOST=0.0.0.0
export PORT="${PORT:-8000}"
export FOUNDRY_ORCHESTRATOR=agent-framework
exec "$NODE" server.mjs
