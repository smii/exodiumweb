#!/bin/bash
# Unpack the Debian 12 (bookworm) libraries headless Chromium needs into
# ./.libs, without root. Run boot-test.mjs with LD_LIBRARY_PATH pointing there.
# Only needed in containers without the libs (e.g. the CloudCLI pod).
set -euo pipefail
cd "$(dirname "$0")"
LIBS="$PWD/.libs"; WORK="$PWD/.debs"
mkdir -p "$LIBS" "$WORK"
MIRROR=https://deb.debian.org/debian
if [ ! -s "$WORK/Packages" ]; then
  curl -fsSL "$MIRROR/dists/bookworm/main/binary-amd64/Packages.xz" | xz -d > "$WORK/Packages"
fi
PKGS="libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libasound2 libatk1.0-0 libatk-bridge2.0-0
libatspi2.0-0 libdbus-1-3 libgbm1 libnspr4 libnss3 libxkbcommon0 libwayland-server0 libdrm2
libxrender1 libsystemd0 libcap2 libgcrypt20 libgpg-error0 liblz4-1 libzstd1 liblzma5 libxi6"
for p in $PKGS; do
  file=$(awk -v p="$p" '$1=="Package:"{cur=$2} $1=="Filename:" && cur==p {print $2; exit}' "$WORK/Packages")
  [ -n "$file" ] || { echo "no package $p"; continue; }
  deb="$WORK/$(basename "$file")"
  [ -s "$deb" ] || curl -fsSL -o "$deb" "$MIRROR/$file"
  dpkg-deb -x "$deb" "$WORK/root"
done
find "$WORK/root" -name '*.so*' \( -type f -o -type l \) -exec cp -P {} "$LIBS/" \;
echo "libs in $LIBS: $(ls "$LIBS" | wc -l)"
