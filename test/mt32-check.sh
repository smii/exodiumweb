#!/bin/bash
# Boot a few MT-32 games on DOSBox-X and keep logs + screenshots.
# Usage (via with-server.sh): BACKEND=dosboxX ALL_CONSOLE=1 bash with-server.sh bash mt32-check.sh <id>...
for id in "$@"; do
  node keys-steps.mjs http://localhost:8090 "$id" "1:30,Enter:15" 15 > "mt32-$id.log" 2>&1
  echo "$id: unreachable=$(grep -ci unreachable "mt32-$id.log") $(grep -i 'mt32\|munt' "mt32-$id.log" | head -2 | tr '\n' ' ')"
done
