#!/bin/bash
# Fetch Exodium's bundled catalogue, eXo configs and cover thumbnails
# (MIT, ~100 MB) into server/data and server/assets. Not committed to git.
# Usage: server/scripts/fetch-upstream-data.sh [exodium tag]
set -euo pipefail
TAG="${1:-v0.15.2}"
SERVER="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://codeload.github.com/tvollstaedt/exodium/tar.gz/refs/tags/$TAG" | tar -xz -C "$TMP"
SRC="$(ls -d "$TMP"/exodium-*)"
mkdir -p "$SERVER/data" "$SERVER/assets"
cp "$SRC/metadata/eXoDOS_configs.zip" "$SRC/metadata/Win3x_configs.zip" "$SERVER/data/"
gunzip -c "$SRC/metadata/exodium.db.gz" > "$SERVER/data/exodium.db"
rm -rf "$SERVER/assets/previews"
cp -r "$SRC/src-tauri/resources/previews" "$SERVER/assets/previews"
cp "$SRC/LICENSE" "$SERVER/data/EXODIUM-LICENSE"
echo "fetched Exodium $TAG data into $SERVER/{data,assets}"
