---
title: "Lands of Lore: Guardians of Destiny"
year: 1997
id: 8315
status: Not supported
backend: dosboxX
size: 3898.14
memsize: 63
cycles: 100000
group: Westwood Studios
tested: 2026-10-23
note: "3.9 GB, four CDs mounted at once"
verified: "not run"
---
# Lands of Lore: Guardians of Destiny (1997)

[← Compatibility](../README.md)

## Why

- The zip is 3.9 GB (5.1 GB unpacked). It is just under `MAX_BUNDLE_MB` (4000), so the player still offers the download.
- The autoexec mounts all four CDs at once (`imgmount d LLGD1.cue … LLGD4.cue`). There is no launcher menu, so the per-campaign disc choice used for [C&C](comcon.md) doesn't apply. The game asks for the discs in turn as the story goes on.
- js-dos keeps the whole bundle in browser memory. Command & Conquer at 1.3 GB already needed about 9 GB of browser memory while unpacking.

Not run in the 2026-10-23 sweep, so that the test pod stays within its memory limit.

## Possible ways forward

- Bundle one disc per chapter and restart the game with the next disc (needs save carry-over between bundles).
- Sockdrive (streamed disk images; see `docs/ARCHITECTURE.md`, spike) instead of one zip in memory.
