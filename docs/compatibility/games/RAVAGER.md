---
title: "Dark Sun II: Wake of the Ravager"
year: 1994
id: 5746
status: Boots
backend: dosbox
size: 637.59
memsize: 32
cycles: 15000
group: Mindscape, Inc.
tested: 2026-10-25
verified: "A picture is shown but didn't change with input (menu, prompt or waiting for a key) (automatic probe, 2026-10-25)"
tags: auto review
---
# Dark Sun II: Wake of the Ravager (1994)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-25, sixnine)

A picture is shown but didn't change with input (menu, prompt or waiting for a key). Status set by the script, not checked by a person; tagged `review`: probably a prompt or quiz the probe can't answer, look before fixing.

| Attempt | Result | Seconds |
|---|---|---:|
| base | TEXTONLY | 118 |
| key:n | TEXTONLY | 125 |
| key:3 | STATIC | 126 |
| key:a | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 244 |
| key:y | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 307 |

Probe steps: `3:6,WAIT:20,Enter:4,Escape:4,Enter:4,Space:4,Enter:6,click:8,Enter:5,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2,hold@ArrowLeft@800:2`
