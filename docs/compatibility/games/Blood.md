---
title: "Blood"
year: 1997
id: 5729
status: Playable
backend: dosboxX
size: 1016.64
memsize: 63
cycles: 100000
tested: 2026-10-25
note: "Launcher option 4 is the 3dfx build (Plasma Pak 3DFX); Build cfg `ScreenMode 0`"
commits: "bea1370"
---
# Blood (1997)

[← Compatibility](../README.md)

## Fixes

| Date | Fix | Where |
|---|---|---|
| 2026-10-09 | Build-engine cfg forced to `ScreenMode 0` (320×200), like Duke 3D. Mixer settings back to the js-dos defaults (blocksize 1024, prebuffer 20). | `bea1370`, `BATPATCH_VERSION` 7 |

## Verified

2026-10-25, 3dfx: launcher option 4 (*Blood: Plasma Pak (3DFX)*, `Blood3D/3DFX.EXE`) runs
on `dosboxX` with js-dos 8.4.1: Plasma Pak splash, the textured main menu with
readable lettering over the 3D scene. Gameplay beyond the menu was not played.
The page crashed at start-up in 3 of 6 runs on 8.4.1 and 4 of 4 on 8.5.3 (1 GB
bundle on a 10 GiB test pod, headless), so bundles of 700 MB or more stay on
js-dos 8.4.1 (`player.html`). Not yet run on a host with more memory.

3dfx check (milestone 7): reaches its menu. See [Shadow Warrior](ShadowWa.md) for the same engine.
