---
title: "Battle Isle 2200"
year: 1994
id: 6293
status: Not supported
backend: dosbox
memsize: 63
cycles: 30000
group: Accolade, Inc.
tested: 2026-10-26
note: " page.waitForFunction: Timeout 240000ms exceeded."
verified: "The player failed to load (automatic probe, 2026-10-26)"
tags: auto broken load-error
---
# Battle Isle 2200 (1994)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-26, sixnine)

The player failed to load. Status set by the script, not checked by a person; tagged `broken` so it can be picked up for a fix.

| Attempt | Result | Seconds |
|---|---|---:|
| base | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 392 |
| backend=dosboxX (`&backend=dosboxX`) | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 294 |
| cpu.core=normal (`&tune=cpu.core=normal`) | FAIL:  page.goto: Timeout 300000ms exceeded. | 300 |
| dosbox.memsize=16 (`&tune=dosbox.memsize=16`) | FAIL:  page.goto: net::ERR_CONNECTION_RESET at http://localhost:18097/player.html?id=6293&autodo | 199 |
| cpu.cputype=386 (`&tune=cpu.cputype=386`) | FAIL:  page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:18097/player.html?id=6293&auto | 0 |

