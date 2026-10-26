---
title: "Blockbuster"
year: 1988
id: 5770
status: Playable
backend: dosbox
size: 0.19
memsize: 8
cycles: auto
group: Mindscape, Inc.
tested: 2026-10-26
verified: "Answered the launcher with 1 (colour output) and K (keyboard), then Space at the title; the Blockbuster breakout field plays. (looked at by Claude, 2026-10-26)"
tags: checked
---
# Blockbuster (1988)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-25, sixnine)

Only a text screen (prompt, DOS shell or settings menu). Status set by the script, not checked by a person; tagged `review`: probably a prompt or quiz the probe can't answer, look before fixing.

| Attempt | Result | Seconds |
|---|---|---:|
| base | TEXTONLY | 73 |
| key:n | TEXTONLY | 87 |
| key:3 | TEXTONLY | 302 |
| key:a | TEXTONLY | 276 |
| key:y | TEXTONLY | 345 |

Probe steps: `WAIT:20,Enter:4,Escape:4,Enter:4,Space:4,Enter:6,click:8,Enter:5,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2,hold@ArrowLeft@800:2`

## Interactive check (2026-10-26, rtm)

Answered the launcher with 1 (colour output) and K (keyboard), then Space at the title; the Blockbuster breakout field plays.

**How to start:** press 1, then K, then Space (key name is 'Space')
