---
title: "Tomb Raider Gold"
year: 1998
id: 4462
status: Partial
backend: dosbox
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
