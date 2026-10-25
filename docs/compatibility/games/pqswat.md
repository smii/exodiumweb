---
title: "Police Quest: SWAT"
year: 1995
id: 6877
status: Not supported
backend: dosbox
size: 3752.27
memsize: 63
cycles: 60000
group: Sierra On-Line
tested: 2026-10-25
verified: "download completes, start fails"
---
# Police Quest: SWAT (1995)

[← Compatibility](../README.md)

## Why

3.5 GB zip. In a browser with a disk-backed profile the download completes, then the start fails with `RangeError: Array buffer allocation failed`: js-dos needs the whole bundle as one ArrayBuffer. In a private window (memory-only storage) the download already fails at 2 GiB. `MAX_BUNDLE_MB` is now 2000 because of this.
