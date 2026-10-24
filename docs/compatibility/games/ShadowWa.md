---
title: "Shadow Warrior"
year: 1997
id: 4806
status: Boots
backend: dosbox
tested: 2026-10-09
note: "`vesa_noflb` typo; Build cfg"
commits: "79dff08, bea1370"
---
# Shadow Warrior (1997)

[← Compatibility](../README.md)

## Fixes

| Date | Fix | Where |
|---|---|---|
| 2026-10-09 | eXo's conf says `vesa_noflb` (typo). DOSBox fell back to `svga_s3`; the translator now maps it to `vesa_nolfb`. | `79dff08`, `server/src/translate.mjs` |
| 2026-10-09 | Build-engine cfg `ScreenMode 0`, as for [Blood](Blood.md). | `bea1370`, `BATPATCH_VERSION` 7 |

## Open

The 3DFX build hit a wasm `unreachable` in headless Chromium. It is not yet
checked in a real browser.
