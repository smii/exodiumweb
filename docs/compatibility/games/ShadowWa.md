---
title: "Shadow Warrior"
year: 1997
id: 4806
status: Playable
backend: dosboxX
size: 582.18
memsize: 63
cycles: 100000
tested: 2026-10-25
note: "`vesa_noflb` typo; Build cfg; answer Y to the VESA prompt"
commits: "79dff08, bea1370"
group: Apogee / 3D Realms
verified: "Launcher 1 (CD audio), VESA prompt Y, menus, new game, first level textured, player moves"
---
# Shadow Warrior (1997)

[← Compatibility](../README.md)

## Fixes

| Date | Fix | Where |
|---|---|---|
| 2026-10-09 | eXo's conf says `vesa_noflb` (typo). DOSBox fell back to `svga_s3`; the translator now maps it to `vesa_nolfb`. | `79dff08`, `server/src/translate.mjs` |
| 2026-10-09 | Build-engine cfg `ScreenMode 0`, as for [Blood](Blood.md). | `bea1370`, `BATPATCH_VERSION` 7 |

## Verified (headless Chromium, test user, 2026-10-25)

Launcher option 1 (CD audio). The game prints `VESA mode 320 x 200 not
found. Continue anyway in standard 320 x 200? (Y / N)`; with `y` it goes on
to the title menu, a new game and the first level, textured, player moves.

Probe steps: `1:6,1:6,WAIT:25,y:15,Space:4,Escape:4,Enter:4,Enter:4,Enter:10,hold@ArrowUp@1500:2,hold@ArrowLeft@800:2`

## Open

The VESA prompt shows on every start (dosboxX backend); `y` is safe.
The 3DFX build (launcher option 2) hit a wasm `unreachable` in headless
Chromium on 2026-10-09 and was not retested.
