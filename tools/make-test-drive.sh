#!/bin/bash
# Sockdrive spike: a small FAT16 hard disk (MBR, one partition) holding
# HELLO.TXT and TEST.ISO (a CD image with CDTEST.TXT), written as a sockdrive
# into $CACHE_DIR/sockdrive/spike. Needs tools/fetch-disk-tools.sh first.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/tools/.bin:$PATH"
export MTOOLS_SKIP_CHECK=1
CACHE="${CACHE_DIR:-$ROOT/dev-data/cache}"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/cd"
echo "hello from the CD image inside a sockdrive" > "$WORK/cd/CDTEST.TXT"
genisoimage -quiet -o "$WORK/TEST.ISO" -V SPIKECD "$WORK/cd"
echo "hello from a sockdrive" > "$WORK/HELLO.TXT"

# 64 MB disk: geometry + MBR from sockdrive.mjs, then FAT16 in the partition.
: > "$WORK/disk.img"
read -r H S C OFF SECS < <(node --input-type=module -e '
  import { geometry, writeMbr } from "'"$ROOT"'/server/src/sockdrive.mjs";
  import { truncateSync } from "node:fs";
  const g = geometry(64 * 2 ** 20);
  truncateSync(process.argv[1], g.bytes);
  const p = writeMbr(process.argv[1], g, 0x06);
  console.log(g.heads, g.sectors, g.cylinders, p.offset, p.sectors);' "$WORK/disk.img")
IMG="$WORK/disk.img@@$OFF"
mformat -i "$IMG" -T "$SECS" -h "$H" -s "$S" -H "$S" -v SPIKE ::
mcopy -i "$IMG" "$WORK/HELLO.TXT" "$WORK/TEST.ISO" ::
mdir -i "$IMG" ::

node --input-type=module -e '
  import { writeSockdrive } from "'"$ROOT"'/server/src/sockdrive.mjs";
  console.log(writeSockdrive(process.argv[1], process.argv[2], { name: "spike", heads: '"$H"', sectors: '"$S"', cylinders: '"$C"' }));
' "$WORK/disk.img" "$CACHE/sockdrive/spike"
