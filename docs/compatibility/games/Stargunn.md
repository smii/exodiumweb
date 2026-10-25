---
title: "Stargunner"
year: 1996
id: 8603
status: Playable
backend: dosbox
size: 579.98
memsize: 32
cycles: 50000
group: Apogee / 3D Realms
tested: 2026-10-25
verified: "Player name entry, skill and mission select, briefing, ship shop (cursor moves, credits 4500, lives 3)"
---
# Stargunner (1996)

[← Compatibility](../README.md)

No game-specific fix needed (Apogee / 3D Realms sweep, 2026-10-25).

## Verified (headless Chromium, test user, 2026-10-25)

Player name entry, skill and mission select, briefing, ship shop (cursor moves, credits 4500, lives 3).

Probe steps: `WAIT:20,Space:4,Enter:4,Enter:4,Enter:4,type@SMII:3,Enter:6,Enter:6,Enter:6,Enter:8,Space:3,hold@ArrowRight@1500:2,hold@ArrowUp@800:2,Space:3`

## Notes

On player select, press Enter on a slot before typing the name. The probe stopped at the ship shop and did not fly; the game is mouse-driven there.
