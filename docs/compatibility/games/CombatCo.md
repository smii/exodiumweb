---
title: "Combat Course"
year: 1989
id: 8451
status: Boots
backend: dosbox
size: 0.22
memsize: 63
cycles: auto
group: Mindscape, Inc.
tested: 2026-10-25
verified: "A picture is shown but didn't change with input (menu, prompt or waiting for a key) (automatic probe, 2026-10-25)"
tags: auto review
---
# Combat Course (1989)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-25, sixnine)

A picture is shown but didn't change with input (menu, prompt or waiting for a key). Status set by the script, not checked by a person; tagged `review`: probably a prompt or quiz the probe can't answer, look before fixing.

| Attempt | Result | Seconds |
|---|---|---:|
| base | STATIC | 288 |
| key:n | STATIC | 361 |
| key:3 | STATIC | 317 |
| key:a | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 354 |
| key:y | STATIC | 79 |

Probe steps: `WAIT:20,Enter:4,Escape:4,Enter:4,Space:4,Enter:6,click:8,Enter:5,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2,hold@ArrowLeft@800:2`
