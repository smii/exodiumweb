# Crackle investigation: fixed CPU cycles in 3dfx confs (2026-10-09)

Hypothesis: eXo 3dfx confs pin `cycles=` to 150k-350k; the emulator can't keep
up, so the audio queue underruns and the sound crackles.

Setup: Furcol (id 1684), menu option `2` (3DFX), local dev server on
`localhost:8090` (secure context, so js-dos plays through the AudioWorklet),
`test/sound-probe.mjs` via `test/run-detached.sh`, 6 s boot + `2` + 15 s + 30 s
(about 50 s of samples). `emuRate` = samples/s the emulator posts (44100 =
real time); `drops` = js-dos "dropping samples" console messages.

| Run | emuRate | drops | loud secs | max rms |
|---|---|---|---|---|
| A default (fixed cycles) | 44098 | 0 | 42 | 0.250 |
| B `cpu.cycles=max` | 44097 | 0 | 42 | 0.261 |
| C `cpu.cycles=auto` | 44101 | 0 | 43 | 0.265 |
| A, CDP throttle 4x | 44099 | 0 | 42 | 0.273 |
| B, CDP throttle 4x | 44103 | 0 | 43 | 0.248 |
| A, CDP throttle 16x | 44095 | 0 | 41 | 0.235 |
| B, CDP throttle 16x | 44085 | 0 | 43 | 0.251 |

Loudness timelines are continuous (no gaps) in every run; the only difference
is the ~2 s offset from when the menu key was seen.

## Result: inconclusive, nothing changed

- No underruns or drops in any configuration, including default cycles. The
  emulator sustains real-time 44.1 kHz with fixed cycles here, so this does
  not reproduce the crackle.
- `cycles=max/auto` made no measurable difference.
- Caveat: CDP `Emulation.setCPUThrottlingRate` appears not to slow js-dos's
  worker (emuRate unchanged even at 16x), so the throttle runs don't prove
  behaviour on a slow client. This sandbox CPU is also not a typical user
  machine. A real repro needs a slow device or OS-level CPU limiting
  (e.g. `taskset`/cgroup quota on Chromium).
- Furcol is a small, light game; a heavy one (Quake/GLQuake-class) would be a
  better stress test.

Recommendation: don't change `translate.mjs`/`BATPATCH_VERSION` (a conf change
re-hashes bundles and forces re-downloads). Revisit only with a reproducible
slow-client case. Crackle is more likely from the main-thread/worklet side
(tab throttling, GC) than from the cycles setting.

Tooling: `test/sound-probe.mjs` gained `THROTTLE=n` (CDP CPU throttle).
