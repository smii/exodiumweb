---
title: "Duke Nukem 3D"
year: 1996
id: 9008
status: Playable
backend: dosbox
tested: 2026-10-09
note: "`ScreenMode=0` (320×200)"
commits: "285eae4"
---
# Duke Nukem 3D (1996)

[← Compatibility](../README.md)

## Fixes

| Date | Fix | Where |
|---|---|---|
| 2026-10-09 | Black screen in VESA 1024×768: `duke3d.cfg` is rewritten to `ScreenMode = 0` (chained 320×200) by `patchBatchFiles`. | `285eae4`, `server/src/batpatch.mjs` (`BATPATCH_VERSION` 5) |

## Notes

The Atomic Edition (`Duke3DAt`) uses the same cfg rewrite.
