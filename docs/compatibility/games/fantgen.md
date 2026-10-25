---
title: "Fantasy General"
year: 1996
id: 2142
status: Boots
backend: dosbox
size: 379.27
memsize: 63
cycles: max
group: Mindscape, Inc.
tested: 2026-10-25
note: "Works with ?tune=cpu.core=normal, needs a rule in translate.mjs"
verified: "A picture is shown but didn't change with input (menu, prompt or waiting for a key) (automatic probe, 2026-10-25)"
tags: auto review fix-candidate
---
# Fantasy General (1996)

[← Compatibility](../README.md)

## Auto-sweep (exo-sweep, 2026-10-25, sixnine)

A picture is shown but didn't change with input (menu, prompt or waiting for a key). Status set by the script, not checked by a person; tagged `review`: probably a prompt or quiz the probe can't answer, look before fixing.

| Attempt | Result | Seconds |
|---|---|---:|
| base | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 306 |
| backend=dosboxX (`&backend=dosboxX`) | FAIL:  page.waitForFunction: Timeout 240000ms exceeded. | 325 |
| cpu.core=normal (`&tune=cpu.core=normal`) | STATIC | 344 |
| dosbox.memsize=16 (`&tune=dosbox.memsize=16`) | STATIC | 87 |
| cpu.cputype=386 (`&tune=cpu.cputype=386`) | STATIC | 91 |

Probe steps: `WAIT:20,Enter:4,Escape:4,Enter:4,Space:4,Enter:6,click:8,Enter:5,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2,hold@ArrowLeft@800:2`
