#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Check both service ports before starting either process.
.venv/bin/python - <<'PY'
import socket
import sys
import errno

occupied = []
for port in (8000, 5173):
    with socket.socket() as connection:
        connection.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            connection.bind(('127.0.0.1', port))
            connection.listen(1)
        except OSError as error:
            if error.errno == errno.EADDRINUSE:
                occupied.append(port)
            else:
                raise SystemExit(f'Cannot check port {port}: {error}')
if occupied:
    print('Startup cancelled: ports already in use: ' + ', '.join(map(str, occupied)))
    print('If ResolveDesk is already running, open http://127.0.0.1:5173')
    print('Otherwise stop the earlier project terminals with Ctrl+C, then retry.')
    sys.exit(1)
PY
.venv/bin/python -m scripts.seed
.venv/bin/uvicorn apps.host.main:app --host 127.0.0.1 --port 8000 &
backend_pid=$!
trap 'kill "$backend_pid" 2>/dev/null || true' EXIT INT TERM
# Wait for backend readiness before launching the frontend.
.venv/bin/python - <<'PY'
import time
import urllib.request

for attempt in range(30):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=1) as response:
            if response.status == 200:
                break
    except OSError:
        time.sleep(0.25)
else:
    raise SystemExit('Backend did not become ready; frontend was not started. See the backend error above.')
PY
npm run dev --prefix apps/web
