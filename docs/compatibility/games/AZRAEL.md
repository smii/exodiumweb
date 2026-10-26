---
title: "Azrael's Tear"
year: 1996
id: 2612
status: Playable
backend: dosbox
size: 414.66
memsize: 63
cycles: 100000
group: Mindscape, Inc.
tested: 2026-10-26
note: "Works with ?tune=cpu.cputype=386, needs a rule in translate.mjs"
verified: "Launcher answered with 1 (SoundBlaster); the intro poem text plays. (looked at by Claude, 2026-10-26)"
tags: fix-candidate checked
---
# Azrael's Tear (1996)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-25, sixnine)

Only a text screen (prompt, DOS shell or settings menu). Status set by the script, not checked by a person; tagged `review`: probably a prompt or quiz the probe can't answer, look before fixing.

| Attempt | Result | Seconds |
|---|---|---:|
| base | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 303 |
| backend=dosboxX (`&backend=dosboxX`) | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 298 |
| cpu.core=normal (`&tune=cpu.core=normal`) | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 294 |
| dosbox.memsize=16 (`&tune=dosbox.memsize=16`) | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 289 |
| cpu.cputype=386 (`&tune=cpu.cputype=386`) | TEXTONLY | 330 |

Probe steps: `WAIT:20,Enter:4,Escape:4,Enter:4,Space:4,Enter:6,click:8,Enter:5,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2,hold@ArrowLeft@800:2`

## Interactive check (2026-10-26, sixnine)

Launcher answered with 1 (SoundBlaster); the intro poem text plays.

**How to start:** press 1 at the launcher menu
