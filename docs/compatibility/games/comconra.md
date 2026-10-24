---
title: "Command & Conquer: Red Alert"
year: 1996
id: 5645
status: Playable
backend: dosbox
group: Westwood Studios
tested: 2026-10-23
note: "Same as C&C"
verified: "Allied + Soviet mission 1; Aftermath, Counterstrike boot"
---
# Command & Conquer: Red Alert (1996)

[← Compatibility](../README.md)

## Fixes

Same two fixes as [Command & Conquer](comcon.md) (2026-10-23):

| Fix | Where |
|---|---|
| Launcher `imgmount` paths rewritten to the bundle layout | `batpatch.mjs`, `BATPATCH_VERSION` 8 |
| Player asks for the campaign and bundles only its disc. The full set is 2.2 GB (2.8 GB unpacked), far beyond what a browser tab can unpack. | `discs.mjs`, `?disc=<key>` |

| Choice | Download |
|---|---|
| 1 Allied Campaign | 607 MB |
| 2 Soviet Campaign | 614 MB |
| 3 Aftermath | 574 MB |
| 4 Counter Strike | 519 MB |
| 5 Network Multiplayer | 574 MB |

## Verified (headless Chromium, test user, 2026-10-23)

- **Allied (1):** intro → mission 1 on the snow map, sidebar and units visible.
- **Soviet (2):** briefing video → mission 1 with the sidebar and the objective "Destroy civilian forces and town". The map starts dark (shroud).
- **Aftermath (3), Counter Strike (4):** boot and play the intro video. Probe steps: `WAIT:20,Escape:10,Enter:10,Enter:10,WAIT:15`.

Allied/Soviet probe steps: `WAIT:20,Escape:10,Enter:10,Enter:10,Enter:15,Escape:10,Escape:10,WAIT:20`.

## Open

Expansion missions (Aftermath, Counter Strike) were not played past the
intro. Network multiplayer is untested (it would need IPX between browsers).
