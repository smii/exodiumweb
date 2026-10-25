---
title: "USS Ticonderoga: Life and Death on the High Seas"
year: 1995
id: 6464
status: Boots
backend: dosbox
size: 407.82
memsize: 63
cycles: 35000
group: Mindscape, Inc.
tested: 2026-10-25
note: "Works with ?tune=cpu.cputype=386, needs a rule in translate.mjs"
verified: "A picture is shown but didn't change with input (menu, prompt or waiting for a key) (automatic probe, 2026-10-25)"
tags: auto review fix-candidate
---
# USS Ticonderoga: Life and Death on the High Seas (1995)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-25, sixnine)

A picture is shown but didn't change with input (menu, prompt or waiting for a key). Status set by the script, not checked by a person; tagged `review`: probably a prompt or quiz the probe can't answer, look before fixing.

| Attempt | Result | Seconds |
|---|---|---:|
| base | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 307 |
| backend=dosboxX (`&backend=dosboxX`) | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 300 |
| cpu.core=normal (`&tune=cpu.core=normal`) | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 306 |
| dosbox.memsize=16 (`&tune=dosbox.memsize=16`) | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 276 |
| cpu.cputype=386 (`&tune=cpu.cputype=386`) | STATIC | 302 |

Probe steps: `WAIT:20,Enter:4,Escape:4,Enter:4,Space:4,Enter:6,click:8,Enter:5,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2,hold@ArrowLeft@800:2`
