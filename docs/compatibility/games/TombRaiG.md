---
title: "Tomb Raider Gold"
year: 1998
id: 4462
status: Playable
backend: dosboxX
size: 463.54
memsize: 63
cycles: 100000
tested: 2026-10-25
note: "3dfx on js-dos 8.5.3 (8.4.1 Voodoo texture cache bug)"
verified: "3dfx: intro FMV, menu text, passport, Caves level textured, inventory"
commits: "01ee179, 12c8b15"
---
# Tomb Raider Gold (1998)

[← Compatibility](../README.md)

## Fixes

| Date | Fix | Where |
|---|---|---|
| 2026-10-10 | With 3dfx on DOSBox-X the intro was white and the menu lettering was replaced by blocks. The game now defaults to the original software-rendered executable on `dosbox` (`SOFTWARE_DEFAULTS` in `index.mjs`). | `01ee179`; deployed as image `fd140e5` |
| 2026-10-25 | Root cause: js-dos 8.4.1's browser Voodoo renderer (`jsdos-voodoo.cpp`) kept stale textures when texture RAM was rewritten (upstream js-dos/emulators issue #440, a Tomb Raider 3dfx test). Fixed upstream in js-dos 8.5.0. 3dfx launches (`dosboxX` + Voodoo) now load js-dos 8.5.3 from `vendor/js-dos-3dfx`; every other game stays on 8.4.1. The software fallback (`SOFTWARE_DEFAULTS`) is removed, so the eXo menu is back and option 3 is the accelerated game. | `player.html`, `server/package.json` (`fetch-jsdos`), `index.mjs` |

## Verified

2026-10-25, headless SwiftShader, default URL (no overrides), launcher option
**3** (3dfx): Core logo and Peru FMV show the real picture (with alternating dark
lines, the game's interlaced FMV; not the white/black stripes of 8.4.1), the
title, open passport and `New Game`/`Game` lettering are legible, a new game
reaches the Caves with textured walls, snow floor and Lara, and the inventory
shows `INVENTORY`/`Compass`. Before (8.4.1, same conf): striped white intro,
teal blocks instead of text. Option 1 (software exe) is still on the menu.

## Open

Not checked on a real GPU or past the first level. The voodoo path needs about
5 GiB in the headless probe (bundle 463 MB); the probe peaked near the 8.5 GiB
memguard limit in a shared pod.

## History

### 2026-10-25 re-check against the js-dos 3dfx recipe

Our player already follows js-dos.com/3dfx.html (`backend dosboxX`,
`backendLocked`, `renderBackend webgl`, `offscreenCanvas`, `workerThread`;
`voodoo_card=opengl`, `glide=false`; console shows `glfx enabled`). Headless
SwiftShader, launcher option 3: the title screen with logo and Lara now renders
correctly, but the intro video is white/black horizontal stripes and the
passport pages and loading-bar texts are flat teal blocks. Config changes made
no difference (frames identical): `voodoo_maxmem=true`/`voodoo_memsize=12`
(eXo's value), `vmemsize=8`, `cputype=pentium_mmx`. So the defect is not in the
conf; the remaining suspects are js-dos's gl4es/WebGL texture upload for
paletted/small textures and the video (VESA) frame while Voodoo is active.
No dos.zone bundle config was reachable to compare. Default stayed software
until the js-dos 8.5.3 fix above (the conf was never the problem).
