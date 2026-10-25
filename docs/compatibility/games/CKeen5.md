---
title: "Commander Keen 5"
year: 1991
id: 2305
status: Playable
backend: dosbox
size: 0.63
memsize: 16
cycles: auto
tested: 2026-10-25
note: "All audio at 44,100 Hz"
commits: "0f5e666"
group: Apogee / 3D Realms
---
# Commander Keen 5: The Armageddon Machine (1991)

[← Compatibility](../README.md)

## Fixes

| Date | Fix | Where |
|---|---|---|
| 2026-10-09 | Sound was quiet and choppy: js-dos plays through an AudioWorklet fixed at 44,100 Hz and doesn't resample. All mixer and sound-chip rates are now forced to 44,100 Hz (about 1,250 eXo configs used 48,000/49,716 Hz). | `0f5e666`, `server/src/translate.mjs` |

## Verified

Start screen, gameplay and music (`test/sound-probe.mjs`). The milestone 1
recording uses this game: [Keen 5 play](../../progress/01-keen5-play.gif).
Commander Keen 4 (`CKeen4`, id `8754`) was checked the same way.

Retested 2026-10-25 in the Apogee / 3D Realms sweep: title, new game, Shadowlands map, Keen walks.
