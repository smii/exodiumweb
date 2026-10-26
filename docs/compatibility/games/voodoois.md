---
title: "Voodoo Island"
year: 1985
id: 7321
status: Not supported
backend: dosbox
size: 0.09
memsize: 63
cycles: auto
group: Mindscape, Inc.
tested: 2026-10-26
verified: "Black screen (automatic probe, 2026-10-26)"
tags: auto broken blank
---
# Voodoo Island (1985)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-26, sixnine)

Black screen. Status set by the script, not checked by a person; tagged `broken` so it can be picked up for a fix.

| Attempt | Result | Seconds |
|---|---|---:|
| base | BLANK | 277 |
| key:n | BLANK | 94 |
| key:3 | BLANK | 153 |
| key:a | FAIL:  page.goto: Timeout 300000ms exceeded. | 300 |
| key:y | FAIL:  page.goto: Timeout 300000ms exceeded. | 300 |

Probe steps: `WAIT:20,Enter:4,Escape:4,Enter:4,Space:4,Enter:6,click:8,Enter:5,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2,hold@ArrowLeft@800:2`
