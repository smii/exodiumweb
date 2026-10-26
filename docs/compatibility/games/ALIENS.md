---
title: "Aliens: A Comic Book Adventure"
year: 1995
id: 2724
status: Playable
backend: dosbox
size: 1186.05
memsize: 16
cycles: 60000
group: Mindscape, Inc.
tested: 2026-10-26
verified: "Any key at the 2-CD notice, then 1 (SoundBlaster); the Aliens main menu (Play, Load Adventure, Introduction) shows. (looked at by Claude, 2026-10-26)"
tags: checked
---
# Aliens: A Comic Book Adventure (1995)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-25, sixnine)

Only a text screen (prompt, DOS shell or settings menu). Status set by the script, not checked by a person; tagged `review`: probably a prompt or quiz the probe can't answer, look before fixing.

| Attempt | Result | Seconds |
|---|---|---:|
| base | TEXTONLY | 273 |
| key:n | TEXTONLY | 169 |
| key:3 | TEXTONLY | 157 |
| key:a | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 242 |
| key:y | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 308 |

Probe steps: `WAIT:20,Enter:4,Escape:4,Enter:4,Space:4,Enter:6,click:8,Enter:5,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2,hold@ArrowLeft@800:2`

First browser error: `QuotaExceededError: The operation failed because it would cause the application to exceed its storage quota.`

## Interactive check (2026-10-26, sixnine)

Any key at the 2-CD notice, then 1 (SoundBlaster); the Aliens main menu (Play, Load Adventure, Introduction) shows.

**How to start:** press any key, then 1
