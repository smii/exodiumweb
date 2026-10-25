# Game compatibility

Which eXoDOS games were tested in ExodiumWeb, how far they got, and what was
fixed for each one. Every tested game has its own page under [games/](games/),
named by its eXo shortcode.

> **Debugging a game?** Check [Global fixes](#global-fixes) first: the same
> symptom has often been solved for another game. **After a test or fix**,
> see [Adding or updating a game](#adding-or-updating-a-game).
> A game not listed is untested. Report one with
> [an issue](https://github.com/smii/exodiumweb/issues/new/choose).

**Contents:** [At a glance](#at-a-glance) · [Status legend](#status-legend) ·
[Global fixes](#global-fixes) · [Known for every game](#known-for-every-game) ·
[How games are tested](#how-games-are-tested) · [Adding or updating a game](#adding-or-updating-a-game)

## At a glance

<!-- generated:stats (node tools/compat-index.mjs) -->
**217 of 7,666 games tested (2.8 %).** 🟢 100 playable · 🟡 108 boots · 🟠 3 partial · 🔴 6 not supported.

🟩🟩🟩🟩🟩🟩🟩🟩🟩🟨🟨🟨🟨🟨🟨🟨🟨🟨🟧🟥 &nbsp;tested games by status

| | Status | Games | Share of tested |
|---|---|---:|---:|
| 🟢 | Playable | 100 | 46.1 % |
| 🟡 | Boots | 108 | 49.8 % |
| 🟠 | Partial | 3 | 1.4 % |
| 🔴 | Not supported | 6 | 2.8 % |

**Find a game:** [all tested games A–Z](GAMES.md) · [searchable table](games.csv) (filter by title, status, backend) · or search this folder for its title. A game not listed is untested.

### By group

| Group | Tested | 🟢 | 🟡 | 🟠 | 🔴 |
|---|---:|---:|---:|---:|---:|
| Apogee / 3D Realms | 52 | 51 | 1 |  |  |
| Sierra On-Line | 133 | 33 | 93 | 2 | 5 |
| Westwood Studios | 23 | 12 | 10 |  | 1 |
| Other games | 9 | 4 | 4 | 1 |  |

### Recently tested

| Game | Status | Tested | Note |
|---|---|---|---|
| [Aces of the Pacific](games/AcesotP.md) (1992) | 🟡 Boots | 2026-10-25 | — |
| [Aces Over Europe](games/AcesOver.md) (1993) | 🟡 Boots | 2026-10-25 | — |
| [Alien Carnage](games/AlienCar.md) (1993) | 🟢 Playable | 2026-10-25 | — |
| [Alien Legacy](games/alienleg.md) (1994) | 🟡 Boots | 2026-10-25 | — |
| [Arctic Adventure](games/ArcticAd.md) (1991) | 🟢 Playable | 2026-10-25 | — |
| [Battle Bugs](games/batlbugs.md) (1994) | 🟡 Boots | 2026-10-25 | — |
| [BC's Quest for Tires](games/BCsQuest.md) (1984) | 🟡 Boots | 2026-10-25 | — |
| [Beyond the Titanic](games/beytitan.md) (1986) | 🟢 Playable | 2026-10-25 | — |
| [Bio Menace](games/BioMenac.md) (1993) | 🟢 Playable | 2026-10-25 | — |
| [Birthright: The Gorgon's Alliance](games/bgorgon.md) (1997) | 🟡 Boots | 2026-10-25 | — |
<!-- /generated:stats -->

## Status legend

| | Status | Meaning |
|---|---|---|
| 🟢 | **Playable** | A new game was started and is controllable: graphics, menus, input. |
| 🟡 | **Boots** | Reaches the game's own title, intro, setup or copy-protection screen. The probe didn't reach gameplay, and no error was seen. |
| 🟠 | **Partial** | Runs, with a known defect (see the game's page). |
| 🔴 | **Not supported** | Cannot run in a browser as it is (size, missing build, emulator gap). |
| ⚪ | **Untested** | Every game without a page. |

## Global fixes

Fixes that apply to every game. Check these first when a game fails the same way.

| Symptom | Cause | Fix | Where |
|---|---|---|---|
| Cursor or view jumps to the top-left when a game limits the mouse (RTS minimaps) | Without pointer lock js-dos sends absolute positions; DOSBox scales them to the game's range and clamps them to its top-left | Per-game "Lock mouse" default (relative movement, as eXo's `autolock=true`), toolbar toggle | `index.mjs` (`MOUSE_CAPTURE_DEFAULTS`), `player.html` ([Warcraft II](games/WarcrafD.md)) |
| Saves gone after quitting a game from its own menu | The launcher's `exit` stopped the emulator before the player could save; Close then timed out | `exit` runs a resident quit program on `X:`; the player sees it, saves, closes | `translate.mjs`, `batpatch.mjs` (`BATPATCH_VERSION` 9), `player.html` |
| Booter (PCjr) game drops to a DOS prompt or "Invalid drive" instead of booting | The eXo config passes the disk image to `boot` with eXo's Windows path (`.\eXoDOS\…\disk.img`); only `mount`/`imgmount` were rewritten | `boot` arguments get the same host-path rewrite | `translate.mjs`, `batpatch.mjs` (`BATPATCH_VERSION` 10) ([KQ1 PCjr](games/KQ1pcjr.md)) |
| Black screen with a blinking cursor after a launcher menu | The launcher `imgmount`s a CD with eXo's Windows path (`.\eXoDOS\…`); the mount fails silently and `cls` hides it | Launcher lines get the autoexec path rewrite | `batpatch.mjs`, `BATPATCH_VERSION` 8+ ([C&C](games/comcon.md)) |
| Browser tab dies loading a multi-CD game | The bundle holds every disc; Chromium needs ~5× the bundle size | Ask for the campaign, bundle only its disc (`?disc=`) | `discs.mjs` ([C&C](games/comcon.md)) |
| Launcher hangs on `IF … program` | js-dos batch interpreter | `IF cond GOTO` + labels | `batpatch.mjs` ([Wing Commander](games/WC.md)) |
| Quiet, choppy sound | js-dos worklet fixed at 44,100 Hz | Force all rates to 44,100 Hz | `translate.mjs` ([Keen 5](games/CKeen5.md)) |
| No music on "w/ MT-32 / Sound Canvas" entries | No MIDI synth in js-dos 8.4.1 | Entries tagged "(no music)"; use the SoundBlaster choice | `batpatch.mjs` |
| Black screen in SVGA games | `svga_s3` on the dosbox backend | `vesa_nolfb`, memsize ≤ 63 | `translate.mjs` ([Quake](games/Quake.md)) |
| Black screen in Build-engine games | VESA hi-res modes | cfg `ScreenMode 0` | `batpatch.mjs` ([Duke 3D](games/Duke3D.md)) |
| Large game re-downloads / download cut off | Single request through Traefik HTTP/2 | 8 MB `Range` pieces, Cache API | `downloads.js` ([EcoQuest](games/ecoq1.md)) |
| Lag and crackle at very high fixed cycles (3dfx games) | eXo configs above what WASM can emulate | Fixed cycles capped at 100,000 | `translate.mjs` (`80902ee`) |

## Resources per game

The [game list](GAMES.md) and [table](games.csv) show what each game asks of the system:

- **Download**: size of the game's zip. js-dos holds a bundle in browser memory several times over while it unpacks (a 1.3 GB bundle was killed at 9.2 GB in the Chromium probe), so plan for roughly 5× this in free RAM on the device. Games over 2 GB are refused (`MAX_BUNDLE_MB`): a 3.5 GB game downloads but fails to allocate its ArrayBuffer ([Police Quest: SWAT](games/pqswat.md)).
- **DOS RAM**: the `memsize` ExodiumWeb gives the emulated PC, capped at 63 MB.
- **CPU**: the emulated speed from the game's config. A number is a fixed cycles count (capped at 100,000, which the WASM core can't outrun); `auto` and `max` let the emulator choose.

The values come from the live collection: `node tools/compat-resources.mjs`, then `node tools/compat-index.mjs`.

## Known for every game

- After quitting a game to DOS, js-dos stays on a black screen with a cursor. Press **Close**.
- Many old games ask setup questions (graphics adapter, drives, sound) before the title. Answer as on a VGA PC with a hard disk and Sound Blaster.
- Copy protection (DragonStrike and others) asks for words from the manual: open the manual in the game's detail panel.

More help for players: the [user manual](../MANUAL.md#troubleshooting).

## How games are tested

Tests run in headless Chromium (software WebGL, no GPU) as a separate test
user, through `test/run-detached.sh` and `test/render-probe.mjs`. The probe
presses keys, clicks and types on a schedule, then saves frames. A real
browser with a GPU runs smoother. See [TROUBLESHOOTING](../TROUBLESHOOTING.md)
for the probe steps and memory limits.

## Adding or updating a game

The game's page is the only place its status is written down. Everything
else (the numbers above, [GAMES.md](GAMES.md), [games.csv](games.csv) and the
summary in the main README) is generated from the pages.

1. Create or edit `games/<shortcode>.md`. It starts with front matter:

   ```yaml
   ---
   title: "Command & Conquer"
   year: 1995
   id: 8170                  # catalogue id
   status: Playable          # Playable | Boots | Partial | Not supported
   backend: dosbox           # dosbox | dosboxX
   tested: 2026-10-23        # last test
   group: Westwood Studios   # optional: test batch or series
   note: "Launcher CD mount path; one disc per campaign"   # optional, one line
   verified: "GDI + NOD mission 1"                         # optional
   commits: "e3fc2bf"                                      # optional
   ---
   ```

   Then the page body: `# Title (year)`, a back link, **Fixes** (date, fix,
   where), **Verified** (what was seen), open issues.
2. A fix that helps many games also gets a row in [Global fixes](#global-fixes).
3. For a new game run `node tools/compat-resources.mjs` first (fills `size`, `memsize`,
   `cycles` from the live pod), then `node tools/compat-index.mjs`. It checks every page's front matter and
   rewrites the generated parts. Once more than 300 games are tested,
   `GAMES.md` turns into a letter index with one page per letter under `list/`.
