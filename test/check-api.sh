#!/bin/bash
# Browser-free API smoke test (run via with-server.sh): health, a normal game,
# and a game over MAX_BUNDLE_MB. Usage: bash with-server.sh bash check-api.sh
B=http://localhost:8090
code() { /usr/bin/curl -s -o /tmp/check-api.out -w '%{http_code}' -H 'Remote-User: smii' "$1"; }
echo "healthz:            $(code $B/healthz) $(/usr/bin/cat /tmp/check-api.out)"
echo "Keen 5 (small):     $(code $B/api/play/2305) $(/usr/bin/head -c 80 /tmp/check-api.out)"
echo "Monkey Island (1.6G): $(code $B/api/play/7843) $(/usr/bin/cat /tmp/check-api.out)"
