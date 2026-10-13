#!/bin/bash
# Have the server fetch + build the given games' bundles ahead of a recording
# (run via with-server.sh / run-detached.sh). Usage: bash prewarm.sh <id>...
for id in "$@"; do
  /usr/bin/curl -s -m 850 -H "Remote-User: smii" "http://localhost:8090/api/play/$id" \
    | /usr/bin/grep -o -E '"title":"[^"]+"|"bundleBytes":[0-9]+|"large":(true|false)|"error":"[^"]+"' | /usr/bin/tr '\n' ' '
  echo
done
