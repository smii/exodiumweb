---
title: "King's Quest I: Quest for the Crown (PCjr)"
year: 1984
id: 7629
status: Playable
backend: dosbox
size: 0.59
memsize: 8
cycles: 250
group: Sierra On-Line
tested: 2026-10-25
verified: "PCjr booter: Sierra/IBM logo, title, castle screen, Graham walks"
---
# King's Quest I: Quest for the Crown (PCjr) (1984)

[← Compatibility](../README.md)

Fixed in this sweep: `boot` lines get the host-path rewrite (Sierra sweep, 2026-10-25).

## Verified (headless Chromium, test user, 2026-10-25)

PCjr booter: Sierra/IBM logo, title, castle screen, Graham walks.

Probe steps: `WAIT:20,Enter:4,Escape:4,Enter:4,Space:4,Enter:6,click:8,Enter:5,hold@ArrowRight@1500:2,hold@ArrowDown@1000:2,hold@ArrowLeft@800:2`

## Notes

A booter disk image: the eXo config passes `.\eXoDOS\KQ1pcjr\…\disk.img` to `boot`. That path wasn't rewritten before this sweep, so the boot failed (see Global fixes).
