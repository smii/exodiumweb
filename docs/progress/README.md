# notexoweb progress

Screenshots and screen recordings from each milestone, newest first. Recordings
are made with the headless test browser (`test/record-play.mjs`, software-only
WebGL, so real browsers run smoother). Each GIF has the full `.webm` next to it.

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
