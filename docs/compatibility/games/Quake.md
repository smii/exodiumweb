---
title: "Quake"
year: 1996
id: 2647
status: Playable
backend: dosbox
size: 617.35
memsize: 63
cycles: auto
tested: 2026-10-09
note: "`svga_s3` → `vesa_nolfb`, memsize 63"
commits: "a68f12e"
---
# Quake (1996)

[← Compatibility](../README.md)

## Fixes

| Date | Fix | Where |
|---|---|---|
| 2026-10-09 | Black screen: `machine=svga_s3` → `vesa_nolfb` and `memsize` capped at 63 on the dosbox backend. | `a68f12e`, `server/src/translate.mjs` |

## Notes

- The eXo zip has no GLQuake/Glide build, so there is no 3dfx mode.
- CD music works.
