#!/bin/bash
# Copy PoC test games from the NAS (read-only on the NAS side).
# Usage: fetch_games.sh <picks.txt: shortcode|zip name|...> <dest dir>
set -uo pipefail
PICKS="$1"; DEST="$2"
NAS=admin@192.168.1.58
EXO="/share/lan/Retro/PC/eXoDOS/eXo"
# -n: never read stdin, or ssh swallows the rest of the picks file
SSH=(ssh -n -i /home/smii/.ssh/id_rsa -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10)
mkdir -p "$DEST/zips" "$DEST/mt32"
fail=0
while IFS='|' read -r short zip _; do
  [ -z "$short" ] || [ "$short" = "-" ] && continue
  out="$DEST/zips/$short.zip"
  if [ -s "$out" ]; then echo "have $short"; continue; fi
  # cat over ssh avoids scp's remote-path quoting rules for names with commas/spaces
  if "${SSH[@]}" "$NAS" "cat \"$EXO/eXoDOS/$zip\"" > "$out.part" && [ -s "$out.part" ]; then
    mv "$out.part" "$out"; echo "got  $short $(du -h "$out" | cut -f1)"
  else
    rm -f "$out.part"; echo "FAIL $short ($zip)"; fail=1
  fi
done < "$PICKS"
# The collection's own launch configs: they must match the zips' eXo version
# (the NAS has eXoDOS 5.0; Exodium bundles 6.04 configs, which differ).
mkdir -p "$DEST/confs"
shorts=$(cut -d'|' -f1 "$PICKS" | grep -v '^-$' | tr '\n' ' ')
for s in $shorts; do
  mkdir -p "$DEST/confs/$s"
  "${SSH[@]}" "$NAS" "cat \"$EXO/eXoDOS/!dos/$s/dosbox.conf\"" > "$DEST/confs/$s/dosbox.conf" \
    || { echo "FAIL conf $s"; fail=1; }
done
echo "confs: $(ls "$DEST/confs" | wc -l)"
if [ ! -s "$DEST/mt32/rev0/MT32_CONTROL.ROM" ]; then
  ssh -i /home/smii/.ssh/id_rsa -o IdentitiesOnly=yes -o BatchMode=yes "$NAS" \
    "cd \"$EXO/mt32\" && tar -cf - ." | tar -xf - -C "$DEST/mt32"
fi
echo "mt32: $(ls "$DEST/mt32"/* | tr '\n' ' ')"
exit $fail
