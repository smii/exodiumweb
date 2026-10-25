---
title: "Command & Conquer"
year: 1995
id: 8170
status: Playable
backend: dosbox
size: 1313.89
memsize: 63
cycles: auto
group: Westwood Studios
tested: 2026-10-23
note: "Launcher CD mount path; one disc per campaign"
verified: "GDI + NOD mission 1, Covert Ops mission"
---
# Command & Conquer (1995)

[← Compatibility](../README.md)

## Symptom (before 2026-10-23)

eXo's launcher menu appeared (1 GDI, 2 NOD, 3 Covert Operations). After a
choice the screen went black with a blinking DOS cursor.

## Fixes

| Date | Fix | Where |
|---|---|---|
| 2026-10-23 | **CD mount in the launcher.** `run.bat` mounts the CDs itself with eXo's Windows host path (`imgmount d ".\eXoDOS\comcon\cd\Command & Conquer CD-1.iso" …`). In the bundle that file is `./comcon/cd/…`, so the mount failed silently and the next `cls` hid the error. The game then reported *UNABLE TO DETECT YOUR CD ROM DRIVE* and quit to the cursor. `batpatch.mjs` now applies the autoexec path rewrite (`rewriteAutoexecLine`) to launcher lines too. | `server/src/batpatch.mjs`, `BATPATCH_VERSION` 8 |
| 2026-10-23 | **One disc per campaign.** The full bundle is 1.3 GB. Chromium needs about 5× that while unpacking, so the test browser was killed at 9.2 GB. The player now asks which campaign to play, then bundles only that campaign's disc. The launcher jumps straight to the choice and mounts only that disc. | `server/src/discs.mjs`, `?disc=<key>` |

The picker as the player shows it (sizes are the download per choice):

| Choice | Disc | Download |
|---|---|---|
| 1 GDI Campaign | CD-1 (GDI) | 375 MB |
| 2 NOD Campaign | CD-2 (NOD) | 363 MB |
| 3 Covert Operations | Covert Operations CD | 594 MB |
| 4 Hidden Campaign | CD-1 | 375 MB |
| 5 Network Multiplayer | CD-1 | 375 MB |

![The disc picker: five campaign buttons with sizes and Cancel](../../progress/08-disc-picker.png)

## Verified (headless Chromium, test user, 2026-10-23)

- **GDI:** Westwood intro → main menu → *Start New Game* → GDI → mission 1 briefing → in game; a minigunner selected and moved by mouse.
- **NOD:** main menu → *Start New Game* → NOD → mission 1 in game.
- **Covert Operations:** reaches a mission with the sidebar and 5000 credits.
- Options 4 (Hidden Campaign) and 5 (Network) were not played.

Probe steps used: `WAIT:20,Enter:12,click@487@225:10,Enter:22,click@250@360:15,Escape:10,Escape:10,WAIT:20`
(GDI logo at 250,360, NOD at 700,360). The main menu ignores arrow keys
in the probe, so use clicks.

## Notes

- Disc swapping (CTRL-F4) isn't available in a single-disc bundle. Each campaign plays from its own disc, so normal play never needs it.
- After *Exit* in the game, js-dos stays on a black screen with a cursor (the DOS `exit`); press **Close**. This is the same for every game.
