---
title: "Winnie the Pooh in the Hundred Acre Wood"
year: 1986
id: 8088
status: Not supported
backend: dosbox
size: 0.14
memsize: 4
cycles: 250
group: Sierra On-Line
tested: 2026-10-25
verified: "not playable"
---
# Winnie the Pooh in the Hundred Acre Wood (1986)

[← Compatibility](../README.md)

## Why

Starting `WINNIE.COM` (a 1.9 KB loader) aborts the DOSBox core (`RuntimeError: unreachable`). Same with machine `tandy`/`cga`, memsize 8, core `normal`, cputype 386, cycles auto; the DOSBox-X backend fails too (`null function`). `dir` on the game drive works, so the bundle is fine.
