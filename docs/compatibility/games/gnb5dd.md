---
title: "The Complete Great Naval Battles: The Final Fury"
year: 1996
id: 5156
status: Not supported
backend: dosbox
memsize: 32
cycles: max
group: Mindscape, Inc.
tested: 2026-10-26
note: " page.waitForFunction: Timeout 240000ms exceeded."
verified: "The player failed to load (automatic probe, 2026-10-26)"
tags: auto broken load-error
---
# The Complete Great Naval Battles: The Final Fury (1996)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-26, sixnine)

The player failed to load. Status set by the script, not checked by a person; tagged `broken` so it can be picked up for a fix.

| Attempt | Result | Seconds |
|---|---|---:|
| base | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 392 |
| backend=dosboxX (`&backend=dosboxX`) | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 294 |
| cpu.core=normal (`&tune=cpu.core=normal`) | FAIL:  page.goto: Timeout 300000ms exceeded. | 300 |
| dosbox.memsize=16 (`&tune=dosbox.memsize=16`) | FAIL:  page.goto: net::ERR_CONNECTION_RESET at http://localhost:18097/player.html?id=5156&autodo | 199 |
| cpu.cputype=386 (`&tune=cpu.cputype=386`) | FAIL:  page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:18097/player.html?id=5156&auto | 0 |

