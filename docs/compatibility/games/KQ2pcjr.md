---
title: "King's Quest II: Romancing the Throne (PCjr)"
year: 1985
id: 8701
status: Partial
backend: dosbox
size: 0.35
memsize: 8
cycles: 300
group: Sierra On-Line
tested: 2026-10-25
verified: "PCjr booter starts and plays from disk 1"
---
# King's Quest II: Romancing the Throne (PCjr) (1985)

[← Compatibility](../README.md)

Known defect, see Notes (Sierra sweep, 2026-10-25).

## Verified (headless Chromium, test user, 2026-10-25)

PCjr booter starts and plays from disk 1.

Probe steps: `Enter:20,WAIT:15,Control+F4:3,Enter:15,WAIT:15,Enter:6,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2`

## Notes

The game asks for disk 2. eXo's launcher says to press Ctrl-F4 to swap disks, but that DOSBox hotkey doesn't reach the js-dos core and the player has no swap control, so the game says "That is the wrong disk". Needs a disk-swap control in the player.
