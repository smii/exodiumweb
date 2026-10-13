#!/bin/bash
# Stand-in for with-server.sh when testing an already-running (deployed)
# instance: same environment, no local dev server. Used via
#   bash run-detached.sh start <name> <secs> ... with RUN_WRAPPER=no-server.sh
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
export LD_LIBRARY_PATH="${LD_LIBRARY_PATH:-$ROOT/poc/test/.libs}"
cd "$HERE" && "$@"
