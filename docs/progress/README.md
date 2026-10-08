# notexoweb progress

Screenshots and screen recordings from each milestone, newest first. Recordings
are made with the headless test browser (`test/record-play.mjs`, software-only
WebGL, so real browsers run smoother). Each GIF has the full `.webm` next to it.

---

## Milestone 2 — media, manuals, per-user saves, first compatibility sweep (2026-10-08)

Everything Exodium shows next to a game now comes straight from the NAS's
eXoDOS 6.04 files (`XODOSMetadata.zip` and the per-game `GameData` zips):
screenshot/box-art gallery with a lightbox, the PDF manual in the built-in
reader, the preview video in the detail panel and the theme music in the
bottom player. The desktop window buttons are gone.

Saves are kept **on the server, per user** (`Remote-User` header from the
login proxy): leaving a game uploads its changed files, starting it again
restores them. Another user starts with a clean copy. Tested automatically
(`test/test-saves.mjs`).

**Recording: detail panel → video preview, gallery, lightbox, manual, theme music**
([full video](02-media.webm))

![Opening Commander Keen 5, playing its video, browsing the gallery and opening the manual](02-media.gif)

**My Library — Recently Played and Installed**

![My Library tab with Recently Played and Installed rows](02-my-library.png)

**Detail panel with video preview and theme music**

![Detail panel showing the preview video area, tags, Play and Manual buttons, the gallery strip and the music bar](02-detail-video.png)

**Gallery lightbox**

![A Commander Keen 5 screenshot opened full-size in the lightbox, thumbnail strip below](02-lightbox.png)

**Manual reader**

![The Commander Keen 5 manual PDF open in the in-app reader](02-manual.png)

**Compatibility sweep, first batch (10 random games, seed 1)**

Each game is started straight in the player, given `1` and Enter for eXo's
launcher menu, then photographed 12 s later. **All 10 boot.** Poker Relay
(black in the sheet) just starts slower than the 12 s wait; given 25 s it
shows its graphics-card menu. Larger batches are next.

![Ten small screenshots from the sweep: nine games showing menus, title screens or gameplay, one black](02-sweep.png)

Batches 2 and 3 (seeds 2 and 3, 10 more games): all boot — Lemmings 2,
Carmen Sandiego Deluxe, RedCat, Many Faces of Go, Miramar and others.
**20 of 20 sampled games start so far.**

![Six more sweep screenshots: Lemmings 2 title menu, Monopoly kit, Many Faces of Go setup, Miramar name prompt, cRiMe, H-Tron](02-sweep-3.png)

**Wing Commander through eXo's own launcher**

js-dos freezes when a batch file runs a program from an `IF` line
(`IF %CHEAT%==N wc`), which eXo launchers do all the time. Bundles now
rewrite those lines into an equivalent `IF … GOTO` form
(`server/src/batpatch.mjs`). With that, the normal launcher works: answer
N (no cheats), then 1, and the game's intro and menu come up.

![Wing Commander's space intro running in the player](02-wc-intro.png)

![Wing Commander's main menu: Start Vega Campaign, Continue Campaign, Start Secret Missions](02-wc-menu.png)

Known issues:
- js-dos's DOSBox-X build crashes on some eXo launcher batch commands, so
  DOSBox-X is only used for 3dfx games; MT-32 music falls back to Sound
  Blaster/AdLib for now.

---

## Milestone 1 — Exodium UI in the browser, games play in-app (2026-10-07)

The unchanged Exodium frontend, served by the notexoweb server against the
**eXoDOS 6.04** collection on the NAS (7,666 games). Search, open the detail
panel, press **Play**: the game boots in an in-app js-dos player; **Close**
returns to the library.

**Recording: search → detail → Play → Commander Keen 5 running → close**
([full video](01-keen5-play.webm))

![Searching for Commander Keen 5, opening it and pressing Play](01-keen5-play.gif)

**Library (Browse, title A–Z)**

![Library grid with cover art, genre and playlist filters and the A–Z jump bar](01-library.png)

**Detail panel**

![Detail panel for Commander Keen 5 with box art, credits, tags, Play button and description](01-detail.png)

**In the player**

![Commander Keen 5's start screen running inside the app, with a Close button](01-playing.png)

Known issues in this milestone (fixed or planned next):
- "Starting…" stayed on top of the game (fixed after this recording).
- The desktop window buttons (minimise/maximise/close) still show top right.
- Manuals, media gallery, video previews and theme music aren't wired up yet.
