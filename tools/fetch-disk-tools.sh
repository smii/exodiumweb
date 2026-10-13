#!/bin/bash
# Unpack mtools (FAT disk images) and genisoimage (ISO 9660) from Debian 12
# into tools/.bin without root, for the sockdrive experiments in a container
# that lacks them. The production image installs them with apt instead.
set -euo pipefail
cd "$(dirname "$0")"
BIN="$PWD/.bin"; WORK="$PWD/.debs"
mkdir -p "$BIN" "$WORK"
MIRROR=https://deb.debian.org/debian
if [ ! -s "$WORK/Packages" ]; then
  curl -fsSL "$MIRROR/dists/bookworm/main/binary-amd64/Packages.xz" | xz -d > "$WORK/Packages"
fi
for p in mtools genisoimage; do
  file=$(awk -v p="$p" '$1=="Package:"{cur=$2} $1=="Filename:" && cur==p {print $2; exit}' "$WORK/Packages")
  deb="$WORK/$(basename "$file")"
  [ -s "$deb" ] || curl -fsSL -o "$deb" "$MIRROR/$file"
  dpkg-deb -x "$deb" "$WORK/root"
done
cp "$WORK/root/usr/bin/mtools" "$WORK/root/usr/bin/genisoimage" "$BIN/"
# mtools dispatches on argv[0] (mformat, mcopy, ...).
for c in mformat mcopy mmd mdir mpartition minfo; do ln -sf mtools "$BIN/$c"; done
echo "tools in $BIN: $(ls "$BIN" | tr '\n' ' ')"
