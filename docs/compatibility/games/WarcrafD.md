---
title: "Warcraft II: Tides of Darkness"
year: 1995
id: 2013
status: Playable
backend: dosbox
size: 1163.57
memsize: 63
cycles: 20000
tested: 2026-10-25
note: "Lock mouse on by default (minimap jumped to top-left)"
verified: "Played by a user up to a mission; minimap fix checked with the mouse-range probe"
---
# Warcraft II: Tides of Darkness (1995)

[← Compatibility](../README.md)

## Problem: the minimap view jumps to the top-left corner (2026-10-25)

Clicking or dragging on certain spots of the in-game minimap moved the view
back to the top-left corner of the map.

**Cause:** without pointer lock js-dos hands DOSBox an **absolute** pointer
position. DOSBox scales it to the game's mouse range (`x × max_x`) and then
clamps it to `[min_x, max_x]`. While the minimap is in use, Warcraft II
narrows that range to the minimap (INT 33h functions 7 and 8), so the
scaled position falls outside the range and is clamped to its top-left
corner, which the game reads as "go to the top-left of the map". eXo's own
DOSBox doesn't show this: it runs with `autolock=true`, i.e. **relative**
mouse movement, and the `[sdl]` section is dropped by the translator.

**Proof** (`test/mouse-probe.mjs` with `test/fixtures/MTEST.COM`, which sets
the range to x 200–300, y 100–150 and reports the final position, host
pointer moved 60 px left from the centre):

| Mouse mode | DOS mouse after the move |
|---|---|
| Absolute (js-dos default) | `200 100`: stuck at the range's top-left |
| Locked (relative) | `248 100`: moves with the pointer |

**Fix:** the server marks Warcraft II as a "Lock mouse" game
(`MOUSE_CAPTURE_DEFAULTS` in `server/src/index.mjs`, sent as
`mouseCapture` in `/api/play/<id>`), and the player starts it with js-dos
`mouseCapture` on. Click the game to capture the pointer, **Esc** releases
it. The 🖱 **Lock mouse** toolbar button switches it per game, and the
choice is remembered in the browser. The bundle and its `confHash` are
unchanged, so nothing is downloaded again.

## Notes

- Large game (1.1 GB): kept in the browser's storage after the first load.
- Lock mouse needs a mouse or trackpad; on touch-only devices the button is
  hidden and the absolute mode stays.
