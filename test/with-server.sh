#!/bin/bash
# Start the dev server, run one command against it, stop the server.
# Usage: test/with-server.sh <command...>     (server log: test/server.log)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
node --env-file="$ROOT/server/dev.env" --disable-warning=ExperimentalWarning "$ROOT/server/src/index.mjs" > "$HERE/server.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
curl -s --retry 15 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:8090/ || { echo "server did not start"; cat "$HERE/server.log"; exit 1; }
export LD_LIBRARY_PATH="${LD_LIBRARY_PATH:-$ROOT/poc/test/.libs}"
cd "$HERE" && "$@"
