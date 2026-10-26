---
title: "Days of Thunder"
year: 1990
id: 5486
status: Playable
backend: dosbox
size: 0.47
memsize: 32
cycles: auto
group: Mindscape, Inc.
tested: 2026-10-26
verified: "Pressed 3 (VGA) at the graphics prompt; the Days of Thunder credits screen shows. (looked at by Claude, 2026-10-26)"
tags: checked
---
# Days of Thunder (1990)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-25, sixnine)

Only a text screen (prompt, DOS shell or settings menu). Status set by the script, not checked by a person; tagged `review`: probably a prompt or quiz the probe can't answer, look before fixing.

| Attempt | Result | Seconds |
|---|---|---:|
| base | TEXTONLY | 343 |
| key:n | TEXTONLY | 324 |
| key:3 | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 353 |
| key:a | TEXTONLY | 79 |
| key:y | TEXTONLY | 79 |

Probe steps: `WAIT:20,Enter:4,Escape:4,Enter:4,Space:4,Enter:6,click:8,Enter:5,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2,hold@ArrowLeft@800:2`

## Interactive check (2026-10-26, rtm)

Pressed 3 (VGA) at the graphics prompt; the Days of Thunder credits screen shows.

**How to start:** press 3 (VGA) at the graphics-mode prompt
