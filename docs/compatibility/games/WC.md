---
title: "Wing Commander"
year: 1990
id: 7085
status: Playable
backend: dosbox
size: 60.82
memsize: 63
cycles: auto
tested: 2026-10-08
note: "`IF cond program` launcher lines → `GOTO`"
commits: "e3fc2bf"
---
# Wing Commander (1990)

[← Compatibility](../README.md)

## Fixes

| Date | Fix | Where |
|---|---|---|
| 2026-10-08 | eXo's `run.bat` starts the game with `IF cond program` lines. js-dos hangs on those, so `batpatch.mjs` rewrites them to `IF cond GOTO` plus a label. | `e3fc2bf`, `server/src/batpatch.mjs` |

## Verified

Intro and main menu through eXo's launcher (sound card menu → game).
Screenshots: [intro](../../progress/02-wc-intro.png), [menu](../../progress/02-wc-menu.png).

## Notes

The `IF` rewrite applies to every launcher, so any game whose `run.bat`
uses the same pattern gets it too.
