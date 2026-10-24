# Game rendering troubleshooting

ExodiumWeb has three separate graphics paths: the SolidJS library UI, media
previews from `Content/GameData`, and the DOS game's canvas in `player.html`.
A missing in-game font is not a missing web font. Keep those paths separate.

## Tomb Raider Gold: white intro and missing text (2026-10-10)

Game `4462`, shortcode `TombRaiG`, js-dos `8.4.1`, app revision `bea1370`.
The deployed image matched the source. A clean, isolated browser reproduced
the white intro and missing menu lettering with launcher option **3**:

| Configuration | Observed result |
|---|---|
| `dosboxX`, `voodoo_card=opengl`, 3dfx executable | White/corrupt intro frames; menu lettering replaced by coloured blocks. Some demo geometry/textures rendered, which is **not** a compatibility pass. |
| `dosboxX`, `voodoo_card=software`, same 3dfx executable | Intro and menu lettering return, but red/blue are swapped. Not a clean workaround. |
| `dosbox`, original non-3dfx executable | Intro video renders, readable `New Game`/`Exit Game`, textured gameplay and readable `INVENTORY`/`Compass`. |

This isolates the reproduced failure to the accelerated Voodoo rendering
path, not missing collection assets or an out-of-date deployment. The exact
defect inside DOSBox-X/gl4es/WebGL has **not** been identified or patched.
The user's gameplay screenshot additionally showed large untextured teal
surfaces; that exact scene was not reproduced in the accelerated test.
Headless Chromium used SwiftShader, not the user's GPU.

**Working fallback:** open `/player.html?id=4462&backend=dosbox`, then choose
**1 - Tomb Raider** (not option 3). This uses the original software-rendered
game; it does not repair 3dfx and is lower-resolution. Do not globally switch
every 3dfx game to this backend.

For a direct launch without the eXo selection menu:

```text
/player.html?id=4462&backend=dosbox&cmd=echo%20C%3A%5CTOMBRAID%20%3E%20TOMBPATH.TXT%7Ccd%20tombraid%7Ctomb
```

The commands set the path used by the original executable, change directory,
and run `tomb`. The NAS archive remains read-only. Existing per-user changes
are still restored by normal player behaviour; the diagnosis above used a
separate test user, not anyone's real saves.

The supplied `Screenshot_20261010_000642.png` and
`Screenshot_20261010_000730.png` show the bad passport and gameplay.
Sampled frames from `Screencast_20261010_000903.webm` showed the library
window, not the separate player; the white intro was independently reproduced.
Keep user recordings and game captures local, not in source control.

## Command & Conquer: black screen with a blinking cursor (2026-10-23)

Game `8170`, shortcode `comcon` (Red Alert `5645`/`comconra` behaves the
same). eXo's launcher asks for a campaign (1 GDI, 2 NOD, 3 Covert
Operations). Any choice ended at a black DOS screen with a blinking cursor.

**Cause:** the launcher `run.bat` mounts the CDs itself:
`imgmount d ".\eXoDOS\comcon\cd\Command & Conquer CD-1.iso" ... -t cdrom`.
That path is eXo's Windows host layout. Inside the bundle the file is
`./comcon/cd/...`, so the mount failed silently, and the next `cls` wiped the
error. The game then said *UNABLE TO DETECT YOUR CD ROM DRIVE* (or asked for
the Covert Operations CD), quit after OK, and left the DOS prompt.
`translate.mjs` already rewrote these paths in the autoexec, but not in
batch files.

**Fix (`BATPATCH_VERSION` 8):** `batpatch.mjs` passes every launcher line
through `rewriteAutoexecLine`, the same rewrite the autoexec gets.

**Second problem, memory:** the full C&C bundle is 1.3 GB (Red Alert
2.2 GB). Chromium needed about 5× that while unpacking, and the test browser
was killed at 9.2 GB. Each campaign plays from a single disc, so the player
now asks for the campaign first and downloads only that disc (`discs.mjs`,
`?disc=<key>`). The launcher is rewritten to jump straight to the choice
(`choice` → `goto <label>`) and to mount only that disc. C&C drops to
363–594 MB per campaign and Red Alert to 519–614 MB. Details:
[compatibility/games/comcon.md](compatibility/games/comcon.md).

To debug a launcher that "returns to a cursor", run the same steps without
the `cls`: `?cmd=` the launcher's lines one by one, or read the patched
`run.bat` in the bundle. Silent `imgmount`/`mount` failures are the usual
cause.

## Reproduce without modifying a player's state

Use a separate `STATE_DIR`, test identity, and unused port. Do not start a
second server on an occupied port. From the homelab checkout at
`/srv/exodiumweb` (whose ignored `server/dev.env` supplies collection access):

```bash
PORT=8097 DEV_USER=render-test STATE_DIR=/tmp/exodiumweb-render-state \
  node --env-file=server/dev.env --disable-warning=ExperimentalWarning \
  server/src/index.mjs
```

In a second terminal, run **one browser at a time**:

```bash
LD_LIBRARY_PATH=/srv/exodiumweb/poc/test/.libs \
  timeout --kill-after=10 240 node test/render-probe.mjs \
  'http://localhost:8097/player.html?id=4462&autodownload=1' \
  /tmp/exodiumweb-render-opengl \
  '3:8,WAIT:15,Escape:2,Escape:2,Escape:2,Enter:4'
```

`render-probe.mjs` records screenshots, console/network errors and player
state. Steps are `key:seconds-to-wait`, `WAIT:seconds`,
`click@x@y:seconds` (mouse click at page coordinates; use it for menus
that ignore arrow keys, as in C&C) or `type@text:seconds`. Keys are held for
150 ms so the emulator sees them. It hides the CSS scanline overlay without
changing stored preferences. An intro can contain interlaced scanlines itself.
It is an **evidence collector**, not an automatic visual-correctness test:
inspect the screenshots, and distinguish attract-mode demos from a new game.

Use `backend=dosbox` and option `1` for the control run.
Use `tune=voodoo.voodoo_card%3Dsoftware` with option `3` only to compare
Voodoo implementations. Keep the same archive and other settings.
Large-game caching can fail in a temporary browser profile even though the
game loads; record that separately from rendering failures.

## Trace the actual launch

1. Read `/api/play/<id>`: backend, translated `conf`, `confHash`,
   `bundleUrl`, `large`, and `bundleBytes`.
2. Inspect the collection's `Content/!DOSmetadata.zip` entry
   `eXo/eXoDOS/!dos/<shortcode>/dosbox.conf`, and the game ZIP's `run.bat`.
   The catalogue's bundled config may be from a different eXo release.
3. Follow `server/src/collection.mjs` -> `translate.mjs` ->
   `index.mjs` (`launchInfo`, `bundleFor`, `patchBatchFiles`) ->
   `server/public/player.html`. `batpatch.mjs` handles DOS batch
   compatibility; `downloads.js` handles browser bundle caching.
4. Match the emulator **and executable**. `voodoo=true` alone is a collection
   template default, not proof of a 3dfx game. The player's WebGL/offscreen
   settings are distinct from DOSBox-X's `voodoo_card` setting.
5. Preserve saved changes. Compare with a fresh test user rather than
   deleting `/state/saves/<user>/<shortcode>.changes` or clearing all storage.
6. Config changes alter `confHash`; batch-only changes require a
   `BATPATCH_VERSION` bump. Do not diagnose an old cached bundle as a new build.
7. Verify intro, legible menu, actual new-game textures and input, not just
   `ci-ready`, absence of exceptions, or a non-black canvas. Do not apply
   global cycle/audio/backend changes to repair a single renderer bug.

For release steps see [DEPLOY.md](DEPLOY.md); changing ignored
`server/vendor/` locally does not change the image, which fetches js-dos
again during the Docker build.
