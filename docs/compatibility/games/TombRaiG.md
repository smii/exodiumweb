---
title: "Tomb Raider Gold"
year: 1998
id: 4462
status: Partial
backend: dosbox
size: 463.54
memsize: 63
cycles: 100000
tested: 2026-10-10
note: "Software renderer by default (3dfx path broken)"
commits: "01ee179"
---
# Tomb Raider Gold (1998)

[← Compatibility](../README.md)

## Fixes

| Date | Fix | Where |
|---|---|---|
| 2026-10-10 | With 3dfx on DOSBox-X the intro was white and the menu lettering was replaced by blocks. The game now defaults to the original software-rendered executable on `dosbox` (`SOFTWARE_DEFAULTS` in `index.mjs`). | `01ee179`; deployed as image `fd140e5` |

## Verified

Intro video, readable `New Game`/`Exit Game`, textured gameplay. The full
reproduction is in [TROUBLESHOOTING](../../TROUBLESHOOTING.md).

## Open

The accelerated (Voodoo) path is not fixed. The defect inside
DOSBox-X/gl4es/WebGL is not identified.

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
No dos.zone bundle config was reachable to compare. Default stays software.
