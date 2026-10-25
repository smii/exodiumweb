---
title: "Duke Nukem 3D"
year: 1996
id: 9008
status: Playable
backend: dosbox
size: 24.44
memsize: 63
cycles: 100000
tested: 2026-10-25
note: "`ScreenMode=0` (320×200)"
commits: "285eae4"
group: Apogee / 3D Realms
verified: "Title, new game, E1L1 textured with HUD, player moves"
---
# Duke Nukem 3D (1996)

[← Compatibility](../README.md)

## Fixes

| Date | Fix | Where |
|---|---|---|
| 2026-10-09 | Black screen in VESA 1024×768: `duke3d.cfg` is rewritten to `ScreenMode = 0` (chained 320×200) by `patchBatchFiles`. | `285eae4`, `server/src/batpatch.mjs` (`BATPATCH_VERSION` 5) |

## Notes

The Atomic Edition (`Duke3DAt`) uses the same cfg rewrite.

## Verified (headless Chromium, test user, 2026-10-25)

Title, new game, E1L1 textured with HUD, player moves (Apogee / 3D Realms sweep).

A run that quits from in-game leaves the launcher's sound-card choice in the
user's save, so the next start asks `change soundcard? [Y,N]`; answer `n`.
