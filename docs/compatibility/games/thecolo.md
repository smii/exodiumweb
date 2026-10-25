---
title: "The Colony"
year: 1988
id: 6829
status: Boots
backend: dosbox
size: 0.25
memsize: 63
cycles: 1500
group: Mindscape, Inc.
tested: 2026-10-25
verified: "Only a text screen (prompt, DOS shell or settings menu) (automatic probe, 2026-10-25)"
tags: auto review
---
# The Colony (1988)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-25, sixnine)

Only a text screen (prompt, DOS shell or settings menu). Status set by the script, not checked by a person; tagged `review`: probably a prompt or quiz the probe can't answer, look before fixing.

| Attempt | Result | Seconds |
|---|---|---:|
| base | TEXTONLY | 321 |
| key:n | TEXTONLY | 289 |
| key:3 | TEXTONLY | 358 |
| key:a | TEXTONLY | 318 |
| key:y | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 354 |

Probe steps: `WAIT:20,Enter:4,Escape:4,Enter:4,Space:4,Enter:6,click:8,Enter:5,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2,hold@ArrowLeft@800:2`
