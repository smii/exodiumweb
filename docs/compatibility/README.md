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
**34 of 7,666 games tested (0.4 %).** 🟢 17 playable · 🟡 15 boots · 🟠 1 partial · 🔴 1 not supported.

🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟨🟨🟨🟨🟨🟨🟨🟨🟧🟥 &nbsp;tested games by status

| | Status | Games | Share of tested |
|---|---|---:|---:|
| 🟢 | Playable | 17 | 50 % |
| 🟡 | Boots | 15 | 44.1 % |
| 🟠 | Partial | 1 | 2.9 % |
| 🔴 | Not supported | 1 | 2.9 % |

**Find a game:** [all tested games A–Z](GAMES.md) · [searchable table](games.csv) (filter by title, status, backend) · or search this folder for its title. A game not listed is untested.

### By group

| Group | Tested | 🟢 | 🟡 | 🟠 | 🔴 |
|---|---:|---:|---:|---:|---:|
| Westwood Studios | 23 | 12 | 10 |  | 1 |
| Other games | 11 | 5 | 5 | 1 |  |

### Recently tested

| Game | Status | Tested | Note |
|---|---|---|---|
| [A Nightmare on Elm Street](games/ANightma.md) (1989) | 🟡 Boots | 2026-10-23 | — |
| [BattleTech: The Crescent Hawk's Inception](games/batltech.md) (1988) | 🟡 Boots | 2026-10-23 | — |
| [BattleTech: The Crescent Hawk's Revenge](games/batltec2.md) (1990) | 🟢 Playable | 2026-10-23 | — |
| [BlackJack Academy](games/bjacad.md) (1987) | 🟢 Playable | 2026-10-23 | — |
| [Circuit's Edge](games/cedge.md) (1990) | 🟢 Playable | 2026-10-23 | — |
| [Command & Conquer](games/comcon.md) (1995) | 🟢 Playable | 2026-10-23 | Launcher CD mount path; one disc per campaign |
| [Command & Conquer: Red Alert](games/comconra.md) (1996) | 🟢 Playable | 2026-10-23 | Same as C&C |
| [Donald's Alphabet Chase](games/DonaldsA.md) (1988) | 🟢 Playable | 2026-10-23 | — |
| [DragonStrike](games/DragonSt.md) (1990) | 🟡 Boots | 2026-10-23 | — |
| [Dune II: The Building of a Dynasty](games/dune2.md) (1992) | 🟡 Boots | 2026-10-23 | — |
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
| Saves gone after quitting a game from its own menu | The launcher's `exit` stopped the emulator before the player could save; Close then timed out | `exit` runs a resident quit program on `X:`; the player sees it, saves, closes | `translate.mjs`, `batpatch.mjs` (`BATPATCH_VERSION` 9), `player.html` |
| Black screen with a blinking cursor after a launcher menu | The launcher `imgmount`s a CD with eXo's Windows path (`.\eXoDOS\…`); the mount fails silently and `cls` hides it | Launcher lines get the autoexec path rewrite | `batpatch.mjs`, `BATPATCH_VERSION` 8+ ([C&C](games/comcon.md)) |
| Browser tab dies loading a multi-CD game | The bundle holds every disc; Chromium needs ~5× the bundle size | Ask for the campaign, bundle only its disc (`?disc=`) | `discs.mjs` ([C&C](games/comcon.md)) |
| Launcher hangs on `IF … program` | js-dos batch interpreter | `IF cond GOTO` + labels | `batpatch.mjs` ([Wing Commander](games/WC.md)) |
| Quiet, choppy sound | js-dos worklet fixed at 44,100 Hz | Force all rates to 44,100 Hz | `translate.mjs` ([Keen 5](games/CKeen5.md)) |
| No music on "w/ MT-32 / Sound Canvas" entries | No MIDI synth in js-dos 8.4.1 | Entries tagged "(no music)"; use the SoundBlaster choice | `batpatch.mjs` |
| Black screen in SVGA games | `svga_s3` on the dosbox backend | `vesa_nolfb`, memsize ≤ 63 | `translate.mjs` ([Quake](games/Quake.md)) |
| Black screen in Build-engine games | VESA hi-res modes | cfg `ScreenMode 0` | `batpatch.mjs` ([Duke 3D](games/Duke3D.md)) |
| Large game re-downloads / download cut off | Single request through Traefik HTTP/2 | 8 MB `Range` pieces, Cache API | `downloads.js` ([EcoQuest](games/ecoq1.md)) |
| Lag and crackle at very high fixed cycles (3dfx games) | eXo configs above what WASM can emulate | Fixed cycles capped at 100,000 | `translate.mjs` (`80902ee`) |

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
3. Run `node tools/compat-index.mjs`. It checks every page's front matter and
   rewrites the generated parts. Once more than 300 games are tested,
   `GAMES.md` turns into a letter index with one page per letter under `list/`.
