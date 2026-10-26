---
title: "Racter"
year: 1984
id: 4115
status: Playable
backend: dosbox
size: 0.05
memsize: 63
cycles: auto
group: Mindscape, Inc.
tested: 2026-10-26
verified: "Typed 'no'; Racter answers ('Who are you then?') so the text conversation works. (looked at by Claude, 2026-10-26)"
tags: checked
---
# Racter (1984)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-25, sixnine)

Only a text screen (prompt, DOS shell or settings menu). Status set by the script, not checked by a person; tagged `review`: probably a prompt or quiz the probe can't answer, look before fixing.

| Attempt | Result | Seconds |
|---|---|---:|
| base | TEXTONLY | 74 |
| key:n | TEXTONLY | 81 |
| key:3 | TEXTONLY | 79 |
| key:a | TEXTONLY | 80 |
| key:y | TEXTONLY | 80 |

Probe steps: `WAIT:20,Enter:4,Escape:4,Enter:4,Space:4,Enter:6,click:8,Enter:5,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2,hold@ArrowLeft@800:2`

## Interactive check (2026-10-26, rtm)

Typed 'no'; Racter answers ('Who are you then?') so the text conversation works.

**How to start:** type answers and press Enter
