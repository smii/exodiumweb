---
name: exodiumweb-troubleshooting
description: Diagnose and fix an eXoDOS game that won't start, shows a black/white screen, loses text, has no sound or crashes in ExodiumWeb. Separates collection/config, launcher batch, DOSBox backend, browser canvas and deployed-image state; uses the headless render probe; consults and updates the per-game compatibility log (docs/compatibility).
allowed-tools:
  - shell
  - Read
  - Edit
  - Write
---

# exodiumweb-troubleshooting

Paths are relative to the repo root. A deployment-specific copy of this skill
may add how its own cluster, wiki or registry work; the method stays this one.

## 0. Consult the compatibility log first, update it last

`docs/compatibility/README.md` holds the status tables, the global-fixes
table and the A–Z index; `docs/compatibility/games/<shortcode>.md` has one
page per tested game (fixes, commits, verified steps, open issues). Before
debugging, read the game's page and **Global fixes**: the same symptom has
often been solved for another game (e.g. "black screen + blinking cursor"
after a launcher menu was a silent CD `imgmount` failure in C&C).

After any test or fix:
1. Update or add the game's page. Its front matter (`title`, `year`, `id`,
   `status: Playable|Boots|Partial|Not supported`, `backend`, `tested`, optional
   `group`, `note`, `verified`, `commits`) is the only place the status is
   written; template and field list: "Adding or updating a game" in
   `docs/compatibility/README.md`. Body: Fixes table (date/fix/where), Verified.
2. A fix that applies to many games gets a row in **Global fixes**.
3. `node tools/compat-index.mjs` validates the pages and regenerates the
   overview, `GAMES.md`, `games.csv` and the README summary. Never edit
   generated files or blocks by hand.

## 1. Establish which pixels failed

Separate the library UI, the GameData media previews (video, gallery) and the
DOS player's canvas. Inspect the actual frames of a screenshot or recording
before claiming it shows the bug. Keep captures local; never upload
recordings, game files or credentials.

## 2. Rule out deployment drift, then follow the exact launch

Compare the running image tag with `git rev-parse --short HEAD`: a fix that
isn't deployed looks exactly like a fix that doesn't work.

Read `/api/play/<id>` on an isolated test server for `backend`, `conf`,
`confHash`, `bundleUrl`, `large`, `bundleBytes` and `discs`. Follow:

- `server/src/collection.mjs`: the collection's `Content/!DOSmetadata.zip`,
  entry `eXo/eXoDOS/!dos/<shortcode>/dosbox.conf`.
- `server/src/translate.mjs`: backend selection, host paths, audio, cycles.
- `server/src/index.mjs`: `launchInfo`, `bundleFor`, `patchBatchFiles`.
- `server/src/batpatch.mjs`: DOS batch compatibility (launcher lines get the
  same path rewrite as the autoexec).
- `server/src/discs.mjs`: multi-disc launchers, one disc per menu choice.
- `server/public/player.html`: js-dos options, saves, canvas, overrides.
- `server/public/downloads.js`: chunked downloads and the browser cache.

Read the game zip's `run.bat` with `ZipReader` (`server/src/zip.mjs`) without
extracting or writing to the collection. The executable matters as much as the
emulator: original and 3dfx choices often use different directories. Always use
the collection's own config, not Exodium's bundled one. `voodoo=true` alone is
a template default; check the translator's real 3dfx detection.

## 3. Reproduce with isolated state, one variable at a time

`docs/TROUBLESHOOTING.md` has the commands. Use a separate `STATE_DIR`,
`DEV_USER=render-test`, an unused port, and **one browser at a time**. Never
use a real user's identity, and never delete or overwrite their saves.

`test/render-probe.mjs <player-url> <output-dir> <steps>` saves frames and
logs. Steps: `key:secs`, `WAIT:secs`, `click@x@y:secs` (menus that ignore
arrow keys, e.g. C&C), `type@text:secs`. It does not judge the picture:
triage frames with a script first (black, blank, unchanged between keys) and
open only the frames a check flags. Screenshots are expensive context.

Run browser tests only through `test/run-detached.sh start <name> <max-secs>
timeout … node render-probe.mjs …`. Its memguard refuses to start above
5 GiB and kills at 8.5 GiB. Chromium needs about 5× the bundle size, so a
1.3 GB bundle gets killed: use `disc=` or skip the game.

URL parameters (`docs/CONFIGURATION.md`): change one of `backend`, `cmd`,
`tune=section.key=value` at a time. `disc=<menu key>` bundles one disc and
skips the menu; `autodownload=1` skips the large-game prompt. Config changes
change `confHash`; batch-only changes need `BATPATCH_VERSION` bumped. Saved
`.changes` overlays can survive bundle changes.

## 4. Use evidence, not an assumed global fix

The Tomb Raider Gold case (`TombRaiG`, 2026-10-10) is the model: the 3dfx
option on `dosboxX` + `voodoo_card=opengl` gave white intro frames and missing
menu text even though some textures rendered; `voodoo_card=software` brought
the text back with red/blue swapped; option 1 on `backend=dosbox` played
properly. That shipped as a documented **fallback**, not a 3dfx fix. Headless
SwiftShader reproduced it too, so it was not a GPU problem.
The real cause (2026-10-25) was a js-dos 8.4.1 Voodoo texture-cache bug, fixed
in js-dos 8.5 (now loaded for 3dfx launches only): when no conf key changes a
rendering defect, check the js-dos changelog and the js-dos/emulators tests.
Details: `docs/compatibility/games/TombRaiG.md`, `docs/TROUBLESHOOTING.md`.

## 5. Verify the real outcome and keep data safe

**Playable** means: correct intro, legible menu, a new game started with
textures, and input working. `ci-ready`, non-black pixels or a running demo
are not compatibility. Don't change cycles, audio, backend or every 3dfx
launcher globally for one game. Never write to the collection (it is mounted
read-only for a reason) or touch per-user saves.

For audio, separate autoplay, PCM rate, absent MIDI synth and CPU underruns;
use `test/sound-probe.mjs` and `docs/progress/crackle-investigation.md`.

Production changes must be reproducible from the `Dockerfile` (edits to the
ignored `server/vendor/` don't ship). Docs-, skill- and test-only changes
need no image build.
