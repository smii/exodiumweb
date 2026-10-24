# Building ExodiumWeb with an AI agent

How ExodiumWeb was built with Claude Code, and how its development machinery
works: agent instructions, the debugging method, the test harness, the
compatibility log, and build and deploy. It is written to be reused, by anyone
continuing this project with Claude or another agent harness/model (Copilot
CLI, Codex, OpenCode, Cursor, Aider …), and as a template for a similar
"port an existing app with an agent" project.

**Contents:** [In short](#in-short) · [How it was built](#how-it-was-built) ·
[Working principles](#working-principles) · [The agent kit](#the-agent-kit-files-an-agent-reads) ·
[How the app works](#how-the-app-works-the-parts-an-agent-touches) ·
[Development environment](#development-environment) · [Test harness](#test-harness) ·
[Test catalogue](#test-catalogue) · [Testing hooks](#testing-hooks) ·
[Troubleshooting method](#troubleshooting-method) · [Compatibility log](#compatibility-log) ·
[Fixing](#where-fixes-go) · [Build and deploy](#build-and-deploy) ·
[Worked example](#worked-example-saves-lost-after-quitting-a-game) ·
[Pitfalls](#pitfalls-agents-hit-here) · [Other harnesses](#using-another-harness-or-model) ·
[Prompt templates](#prompt-templates) · [Reusing the approach](#reusing-the-approach-for-another-project)

---

## In short

- **Human:** direction, taste, playtesting, decisions on risk (what ships,
  what's deferred). **Agent:** reading upstream code, writing the server, the
  translator and the browser shims, the test tooling, headless reproduction of
  bugs, docs.
- **Built in about 18 days** (2026-10-07 → 2026-10-25), 50+ commits, most
  co-authored by Claude (Claude Code, Opus 5.5) running in a Kubernetes pod
  next to the cluster that hosts the app.
- **What made it work:** a short instruction file with hard rules; a written
  debugging method (a *skill*); a test harness that can't take the
  workstation down; a compatibility log that acts as the project's long-term
  memory; and "evidence before claims" (screenshots, a headless probe, server
  state) instead of "it should work now".
- **Everything is plain Markdown and shell/Node scripts.** Nothing depends on
  one vendor's agent; see [Using another harness or model](#using-another-harness-or-model).

---

## How it was built

The history, from `git log` and [the progress log](progress/README.md):

| Date | Milestone | What the agent did |
|---|---|---|
| 10-07 | **Proof of concept** (`poc/`) | Booted 10 original eXoDOS zips with js-dos 8.4.1 from a read-only NAS share. Wrote an eXo `dosbox.conf` → js-dos translator and ran it over all 7,666 configs (no host path left unconverted). Recorded findings that shaped the real app ([poc/README.md](../poc/README.md)). |
| 10-07 | **MVP** | Copied Exodium's Svelte/Tauri frontend unchanged and replaced its 7 Tauri modules with browser shims (`ui/web-shims/`). `invoke()` became `POST /api/invoke/<cmd>` on a dependency-free Node server that ports Exodium's Rust commands ([ui/UPSTREAM.md](../ui/UPSTREAM.md)). |
| 10-08 | Media, per-user saves, bundles | Per-user SQLite copies of the catalogue, js-dos "changes" blobs on the server, bundles built and cached per config. |
| 10-08 | **Test tooling** | Random compatibility sweep + screenshot classifier; the detached runner with a memory guard after Chromium OOM-killed the whole pod (chat included). |
| 10-08/09 | Large games | Download once in 8 MB `Range` pieces into the Cache API; ask first; a Downloads page. |
| 10-09 | Deploy | Container image, `/healthz`, kaniko build Job, Kubernetes manifests in the homelab repo. |
| 10-09 | Library look, Reading Room, phones, Back button, scanlines | UI work, kept as a short list of local changes to upstream. |
| 10-09 | Sound, 3dfx, SVGA, Build engine | Global fixes found by probing many games (44.1 kHz audio, `vesa_nolfb`, Build-engine `ScreenMode 0`, cycle cap). |
| 10-10/13 | Tomb Raider Gold | The model investigation for "use evidence, not an assumed global fix" ([TROUBLESHOOTING.md](TROUBLESHOOTING.md)). |
| 10-13 | Easy reuse | `compose.yaml`, Helm chart, single-user mode ([DEPLOY.md](DEPLOY.md)). |
| 10-23 | **C&C / Red Alert playable** | Launcher CD mounts rewritten; multi-disc games bundle only the chosen campaign's disc. Started the per-game compatibility log. |
| 10-24 | Docs for agents and players | Compatibility page with charts and A–Z index, user manual, agent docs. |
| 10-25 | **Saves on in-game quit** | See the [worked example](#worked-example-saves-lost-after-quitting-a-game). |

The loop for each step was the same: the human states the goal or the bug
("saves are gone after I quit"), the agent reads the relevant docs and code,
reproduces it headlessly, fixes it in the right layer, proves it with a test,
updates the docs and the compatibility log, then builds, deploys and checks
the running version.

---

## Working principles

These are the rules that held up. They are written into the agent files so
every new session starts with them.

1. **Hard rules first, at the top of the instruction file.** Things that are
   expensive or impossible to undo: never write to the collection, never touch
   a real user's saves, one browser test at a time, no game files or
   credentials in git.
2. **Keep the instruction file short; put detail in linked docs.** The agent
   reads `CLAUDE.md` every turn; it should be a map ("a game misbehaves → read
   the skill"), not a manual.
3. **A written method beats memory.** The troubleshooting skill encodes what
   past investigations learned (check deployment drift first, follow the
   exact launch, one variable at a time, what *Playable* means). A new session
   or a different model gets the same method.
4. **Evidence, not assumptions.** A fix counts when a test shows it: a
   probe screenshot of the real menu, a save file read back after a relaunch.
   `ci-ready`, "no exceptions" or a non-black canvas are not proof.
5. **Fix in the right layer, and narrowly.** Game fixes go into the cached
   bundle (translator, batch patches), never the source collection. Don't
   change cycles/audio/backend globally to fix one game.
6. **The compatibility log is the memory.** Every test and fix lands in a
   per-game page and the global-fixes table, so the next "black screen" is
   checked against everything already solved.
7. **Guard the environment.** The agent, dev server and Chromium share one
   container memory limit; the harness refuses to start a test when memory is
   high and kills it before the container OOMs.
8. **Isolated identities for tests.** Tests run as `render-test` with their
   own state directory, never against a real user.
9. **Verify deployment, not just the commit.** Compare the running image tag
   with `git rev-parse --short HEAD`: an undeployed fix looks exactly like a
   fix that doesn't work.

---

## The agent kit (files an agent reads)

| File | Role | Read when |
|---|---|---|
| [`CLAUDE.md`](../CLAUDE.md) | Hard rules, a "where things are" map, build/test commands, game-fix steps. Short on purpose. | Every session (Claude Code loads it automatically). |
| [`AGENTS.md`](../AGENTS.md) | Points other harnesses (Codex, Copilot, OpenCode, Cursor…) at the same files. | Every session, for harnesses that read `AGENTS.md`. |
| [`.claude/skills/exodiumweb-troubleshooting/SKILL.md`](../.claude/skills/exodiumweb-troubleshooting/SKILL.md) | The debugging method, step by step. Plain Markdown with a YAML header (`name`, `description`) so Claude Code picks it up as a skill; any agent can just read it. | A game won't start, shows black/white, has no sound, crashes. |
| [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) | Server, bundles, player, users, saves. | Changing server or player code. |
| [`docs/CONFIGURATION.md`](CONFIGURATION.md) | Environment variables, per-game settings, testing URL parameters. | Tests and config. |
| [`docs/TROUBLESHOOTING.md`](TROUBLESHOOTING.md) | Investigations with commands (Tomb Raider, C&C), isolated reproduction, tracing a launch. | Debugging. |
| [`docs/compatibility/`](compatibility/README.md) | Status tables, global fixes, one page per tested game. Partly generated. | Before and after every game test. |
| [`docs/progress/README.md`](progress/README.md) | Milestones with screenshots and recordings. | Milestone-sized changes. |
| [`docs/MANUAL.md`](MANUAL.md) | What players see and do. | User-visible changes. |
| [`docs/DEPLOY.md`](DEPLOY.md) | Install, operate, upgrade. | Release and ops. |
| [`ui/UPSTREAM.md`](../ui/UPSTREAM.md) | Which `ui/` files differ from upstream Exodium, and why. | Any edit under `ui/src`. |
| This file | How it all fits, for reuse. | Onboarding a new person or agent. |

A deployment can add a thin wrapper skill that defers to this one and only
adds its own cluster, registry and wiki rules (the author's homelab does). The
method stays here, in the app repo.

---

## How the app works (the parts an agent touches)

Full detail: [ARCHITECTURE.md](ARCHITECTURE.md).

```
browser ── Exodium UI (ui/, Svelte) ── POST /api/invoke/<cmd> ──► Node server (server/src)
   │                                                               ├─ catalogue + per-user SQLite DBs (/state/users)
   └─ player.html (iframe) ── js-dos 8.4.1 (WASM DOSBox / DOSBox-X)├─ /api/play/<id> → launch info
          │  GET bundle.jsdos  ◄─────────── bundle built per config ┤  (translate.mjs, batpatch.mjs, discs.mjs)
          │  GET/PUT /api/saves/<id> ◄───── per-user "changes" blob ┘  /state/saves/<user>/<shortcode>.changes
```

The launch path, which every game bug follows:

1. **`collection.mjs`** reads the game's own `dosbox.conf` from the
   collection's `Content/!DOSmetadata.zip` (`eXo/eXoDOS/!dos/<shortcode>/`).
2. **`translate.mjs`** rewrites it for js-dos: drops host-only sections and
   keys, rewrites Windows mount paths, picks the backend (`dosbox` or
   `dosboxX` for 3dfx/MT-32), forces 44.1 kHz audio, caps cycles. It also turns
   `exit` into the quit program (see the worked example).
3. **`index.mjs` `launchInfo`** applies per-game settings and testing
   overrides and hashes the final config (`confHash`).
4. **`index.mjs` `bundleFor`** builds `<shortcode>-<confHash>.jsdos`: the game
   zip's entries copied as-is, plus `.jsdos/dosbox.conf`, patched batch files
   (`batpatch.mjs`), MT-32 ROMs if needed, the quit program, and for multi-disc
   games only the chosen disc (`discs.mjs`). Cached on disk, LRU-pruned.
5. **`player.html`** fetches launch info, downloads the bundle (large ones
   once into browser storage via `downloads.js`), starts js-dos, pulls the
   user's save blob, and pushes it on Close, Back, in-game quit and autosave.

### The player's test API: `window.__player`

`player.html` exposes its state so tests and probes don't have to guess from
pixels:

| Field | Meaning |
|---|---|
| `ready` | js-dos reported `ci-ready` (the emulator runs). |
| `error` | Launch error text (shown to the player too). |
| `events` | Every js-dos event seen, in order. |
| `ci` | The js-dos command interface: `fsReadFile`, `fsWriteFile`, `getRunningProgram`, `persist`, `exited` … |
| `restored` | A save blob was pulled from the server at start. |
| `saved` | Number of successful save uploads. |
| `quit` | The game quit by itself and the player saved and closed. |
| `fromStorage` / `downloaded` / `stored` | Large-game path: started from browser storage / downloaded now / the download could be kept. |

---

## Development environment

- **Node ≥ 22.13, no npm dependencies on the server** (`node:sqlite`,
  `node:zlib`, `node:http`). The UI builds with `cd ui && npx --yes pnpm@9 build`.
- **Dev server:** `cd server && npm run dev`, or via the test wrappers below.
  Settings come from the ignored `server/dev.env`: here the collection is read
  over ssh (`COLLECTION_SSH=…`) into a local cache, so the share is never
  written to. Without a collection, see `tools/make-test-drive.sh` and
  [CONFIGURATION.md](CONFIGURATION.md).
- **Isolation:** run tests with `DEV_USER=render-test STATE_DIR=/tmp/<somewhere>`.
  Environment variables beat `--env-file`, so this overrides `dev.env`. Never
  point a test at a production `/api/*` with a test `Remote-User` header: it
  creates a user database on the production volume.
- **Where the agent ran:** Claude Code inside a Kubernetes pod with a 4 GiB
  memory limit, shared with the dev server and headless Chromium. That limit is
  why the harness below exists. On a laptop the same scripts work; the guard
  then reads your cgroup or falls back to defaults.

---

## Test harness

Browser tests boot a real emulator in headless Chromium (SwiftShader WebGL).
They are heavy (Chromium needs about **5× the game bundle size** in memory) and
slow (1–3 minutes). Three scripts make them safe to run from an agent:

| Script | What it does |
|---|---|
| `test/with-server.sh <cmd…>` | Starts the dev server on :8090, waits for it, runs one command, stops the server. Log: `test/server.log`. |
| `test/run-detached.sh start <name> <max-secs> <cmd…>` | Runs `with-server.sh <cmd…>` **fully detached** (`setsid`), so it survives the agent session restarting (a restart kills every child process and the chat looks hung). One run at a time (a lock in `test/runs/.active`), a hard time limit, and the memory guard. Output in `test/runs/<name>/{log,status,pid}`. |
| `run-detached.sh status [name]` / `stop <name>` | `status` prints `running`, `done <rc>`, `timeout` or `stopped`, plus peak memory. |
| `test/memguard.sh` | Sourced by the above. Refuses to start above half the container memory limit and kills the whole process group at 85%, before the kernel OOM-kills the pod. |
| `test/no-server.sh` | Stand-in wrapper for testing an already-deployed instance: `RUN_WRAPPER=no-server.sh`. |

Typical use from an agent:

```bash
cd test
DEV_USER=render-test STATE_DIR=/tmp/ew-state \
  bash run-detached.sh start saves 240 node test-dos-save.mjs
# … later, without blocking on a long sleep:
bash run-detached.sh status saves      # running | done 0 | timeout
tail -20 runs/saves/log
```

Poll the status with a bounded loop, or just check it again on the next turn.
Don't wait for the word `running` to disappear in an unbounded loop: if the
status format changes, the loop never ends.

---

## Test catalogue

All in `test/`. Browser scripts take a base URL (default
`http://localhost:8090`) and run as the dev server's user.

| Script | Purpose |
|---|---|
| `render-probe.mjs <player-url> <out-dir> [steps]` | **The main debugging tool.** Boots one game, runs key steps (`key:secs`, `WAIT:secs`, `click@x@y:secs`, `type@text:secs`), saves a frame per step plus console, network errors and `__player` state. It collects evidence; it doesn't judge the picture. |
| `keys-steps.mjs <base> <id> "<keys>"` | Older step-and-screenshot script; `CMD_FILE` replaces the launcher with DOS lines from a file (`test/cmds/`). |
| `debug-player.mjs <base> <id> [secs]` | Console dump + one screenshot. |
| `sweep.mjs <base> [count] [seed] [secs]` | Random compatibility sweep: boots N games, presses Enter/1 for launcher menus, screenshots and classifies. |
| `classify.mjs`, `reclassify.mjs`, `contact.mjs` | Screenshot triage: BLANK / TEXT / GRAPHICS from the emulator area only; re-score a sweep; contact sheet. Use these before opening images. |
| `cv-probe.mjs`, `dfx-probe.mjs`, `fps-probe.mjs` | Canvas, 3dfx and frame-rate probes. |
| `sound-probe.mjs` | Taps js-dos audio output: loudness per second, a WAV, screenshots. |
| `test-saves.mjs <base> <id> <dir>` | Save round-trip via the Close button (file written through the JS API). |
| `test-dos-save.mjs <base> <id> <dir>` | Save round-trip when **DOS** writes the file and the game quits by itself (`BACKEND=dosboxX` for the other backend). |
| `test-large.mjs` | Large-game flow with a small game (`LARGE_BUNDLE_MB=1`): ask, download, run; second start from storage. |
| `probe-live-download.mjs` | A large bundle through the real proxy path (deployed instance). |
| `test-back.mjs`, `test-ui.mjs`, `test-mobile.mjs` | Back button closes the game and stays in the app; UI pass; phone layout. |
| `record-play.mjs`, `record-detail.mjs`, `make-gif.mjs`, `readme-shots.mjs`, `preview.mjs` | Recordings and screenshots for docs. |
| `check-api.sh`, `check-reading.sh`, `mt32-check.sh`, `prewarm.sh` | Browser-free API checks, MT-32 boots, prebuilding bundles. |
| `memhog.mjs` | Self-test for the memory guard. |

UI unit tests: `ui/src/stores/*.test.ts` (Vitest). Typecheck:
`cd ui && npx tsc --noEmit -p .`.

---

## Testing hooks

URL parameters on `player.html?id=<id>&…` (full list: [CONFIGURATION.md](CONFIGURATION.md)).
They change the config, so each gets its own `confHash` and bundle:

| Parameter | Effect |
|---|---|
| `backend=dosbox\|dosboxX` | Force the emulator build. |
| `cmd=line\|line` | Replace the autoexec's commands (mounts and drive switches stay). Run DOS commands directly, e.g. `cmd=echo x > T.TXT\|dir`. An `exit` here quits like a game does. |
| `tune=section.key=value\|…` | Set or replace config keys, e.g. `tune=voodoo.voodoo_card%3Dsoftware`. |
| `disc=<menu key>` | Multi-disc games: bundle one disc and skip the menu. |
| `autodownload=1` | Skip the large-game download question. |

Server-side: `LARGE_BUNDLE_MB` (threshold for download-once), `MAX_BUNDLE_MB`
(refuse), `BATPATCH_VERSION` in `batpatch.mjs` (bump so batch-only changes
rebuild bundles).

---

## Troubleshooting method

The full method is the [skill](../.claude/skills/exodiumweb-troubleshooting/SKILL.md).
Condensed:

0. **Read the compatibility log first:** the game's page and **Global fixes**.
1. **Which pixels failed?** Library UI, media preview or the DOS canvas.
2. **Deployment drift?** Running image tag vs `git rev-parse --short HEAD`.
3. **Follow the exact launch:** `/api/play/<id>` on a test server (backend,
   conf, confHash, bundleUrl, large, discs), then the files in
   [the launch path](#how-the-app-works-the-parts-an-agent-touches). Read the
   game zip's `run.bat` with `ZipReader`; the executable matters as much as the
   emulator.
4. **Reproduce in isolation, one variable at a time** with `render-probe.mjs`
   and the testing hooks.
5. **Evidence, not an assumed global fix** (the Tomb Raider Gold case).
6. **Verify the real outcome.** *Playable* = correct intro, legible menu, a
   new game started with textures, input working.
7. **Update the log**, publish, and deploy if code changed.

For data the server stores (saves), look at the stored artifact itself. The
save bug was found by unzipping the production `.changes` blobs and seeing
only folders in them.

---

## Compatibility log

One page per tested game, `docs/compatibility/games/<shortcode>.md`, is the
source of truth. Its front matter holds the status (🟢 Playable, 🟡 Boots,
🟠 Partial, 🔴 Not supported), year, catalogue id, backend, test date and a
one-line note; the body has the fixes (date, change, where), what was
verified and open issues.

`node tools/compat-index.mjs` validates every page and generates the rest, so
the overview stays small however many games get tested:

- `docs/compatibility/README.md`: counts, a one-line status bar, a per-group
  table and the last 10 tests, plus the hand-written **Global fixes** table.
- `GAMES.md`: every tested game A–Z in one table. Above 300 games it becomes
  a letter index with one page per letter (`list/A.md` …).
- `games.csv`: the same list, which GitHub shows as a table you can search
  and filter.
- The main README's one-line summary.

After any test or fix: update the game's page, add a Global-fixes row if the
fix applies to many games, run the generator, and never edit generated files.
A deployment can mirror these pages into its own wiki (the author's homelab
has a sync script).

---

## Where fixes go

| Problem kind | Layer | Notes |
|---|---|---|
| eXo config doesn't fit js-dos (paths, sections, audio, SVGA, cycles) | `server/src/translate.mjs` | Changes the conf, so `confHash` changes and bundles rebuild by themselves. |
| Launcher batch files (IF + program, CD `imgmount`, MIDI switches, `exit`) | `server/src/batpatch.mjs` | **Bump `BATPATCH_VERSION`**, or cached bundles keep the old batch files. |
| Game files inside the bundle (Build-engine cfg) | `index.mjs` `patchBatchFiles` | Patched copy in the bundle; the source zip is untouched. |
| Multi-disc launchers | `server/src/discs.mjs` | One disc per menu choice. |
| Player behaviour (saves, toolbar, js-dos options) | `server/public/player.html` | No bundle rebuild needed. |
| Large-game download and storage | `server/public/downloads.js` | |
| Library UI | `ui/web-shims/` first; `ui/src` only if unavoidable, then list it in `ui/UPSTREAM.md` | Keeps an upstream Exodium drop-in possible. |

Never write to the collection, also not from tests. Edits to the ignored
`server/vendor/` don't ship: the image fetches js-dos in the `Dockerfile`.

---

## Build and deploy

- **Image:** `docker build -t exodiumweb .`; everything shipped comes from the
  `Dockerfile` (UI build, js-dos download, Exodium catalogue).
- **Generic installs:** plain Docker, `compose.yaml` or the Helm chart in
  `charts/` ([DEPLOY.md](DEPLOY.md)).
- **The author's setup** (for reference): commit and push, then a one-off
  kaniko Job builds the pinned tag from the checkout
  (`sed "s/__TAG__/$(git rev-parse --short HEAD)/g" deploy/build-job.yaml | kubectl create -f -`,
  about 3 minutes) and pushes to a private registry. The tag is bumped in the
  homelab repo's manifest, ArgoCD syncs, and the running image is checked. The
  Deployment uses `Recreate`, so a crashing image means downtime: test the
  server locally first. Docs-, skill- and test-only changes need no image.

---

## Worked example: saves lost after quitting a game

A complete agent session (2026-10-25), useful as a template.

**Report:** "Saves are not permanent. When I exit a game and start it again
from the UI, the savegame is gone."

1. **Loaded the skill and the docs.** ARCHITECTURE says saves are a js-dos
   "changes" blob, pulled on start and pushed on close/autosave.
2. **Checked the stored artifact.** Save files existed on the server with
   recent timestamps, so uploads worked. Unzipping them showed only folders
   and config files, no save games (e.g. no `SAVEGAM*.WL6` for Wolfenstein 3D).
   The data was being lost before upload, not on restore.
3. **Read the vendor code** (minified js-dos): changes = files whose mtime is
   newer than the bundle's extraction time. That should include DOS writes.
4. **Tested the hypothesis headlessly:** `cmd=echo … > DOSWRITE.TXT` + Close →
   the file *was* in the blob. So the Close path worked, and the loss had to be
   another exit path.
5. **Found the path:** in-game Quit → launcher `exit` → the emulator stops.
   A probe showed `ci.exited === true`, no `exit` event reached the player,
   and `persist()` never answered. Close then waited out its 8 s save timeout.
6. **Designed around it:** js-dos can't save after DOSBox stops, so DOSBox
   must not stop. Every `exit` (autoexec, launcher batches, IF commands) now
   runs `X:\EXOQUIT.COM`, a 4-byte resident program (`sti; hlt; jmp`), on a
   drive letter no eXo config uses (checked across all 7,666 configs). A probe
   confirmed `ci.getRunningProgram()` reports `EXOQUIT`. The player polls it
   once a second, then saves and closes like the Close button.
7. **Proved it:** `test/test-dos-save.mjs`, where DOS writes a file, quits,
   the player saves and closes on its own, and a relaunch restores the file.
   It passed on both backends, and a real game still booted.
8. **Shipped:** `BATPATCH_VERSION` 9, docs (ARCHITECTURE, Global fixes,
   MANUAL), commit with a why-body, image build, manifest bump, running image
   verified.

What carried over: look at the stored data before theorising; split "upload
broken" from "nothing to upload"; test each exit path separately; prove a
fix with a test that reproduces the user's exact sequence.

---

## Pitfalls agents hit here

| Pitfall | What to do |
|---|---|
| Starting a second browser test, or the dev server twice | One run at a time through `run-detached.sh` (it holds a lock). |
| Testing as a real user (the `DEV_USER` in `dev.env`) | Always `DEV_USER=render-test STATE_DIR=/tmp/…` on the command line. |
| Diagnosing an old cached bundle | Config changes change `confHash`; batch-only changes need a `BATPATCH_VERSION` bump. Check `bundleUrl`. |
| "Fixed" because `ci-ready` fired or the canvas isn't black | Look at the frames; *Playable* has a definition. |
| Opening every screenshot | Classify first (`classify.mjs`); open only the flagged frames. Images cost a lot of context. |
| Unbounded wait loops / long sleeps | Check status, then come back. Use bounded loops with a timeout. |
| DOSBox shell differences | E.g. `choice /t:` isn't supported (the probe hangs on the prompt); use non-interactive commands in `cmd=`. |
| Race between JS writes and DOS | A file written with `ci.fsWriteFile` after boot may not be visible to a command already queued in the autoexec. Ship test files in the bundle, or have DOS write them. |
| Long `sed` one-liners rewriting code | Write the file, or use a small script with an exact match and an `assert`. |
| Push rejected (someone edited the README on GitHub) | Stop the build that would use the unpushed commit, rebase onto `origin/main`, push, then build. |
| Large games re-download after a conf change | Expected: the bundle URL includes `confHash`. Mention it in release notes. |
| Edits under `server/vendor/` | Ignored and not shipped; fix in the Dockerfile or the app. |

---

## Using another harness or model

Nothing here is Claude-only. What each harness needs:

| Harness | Setup |
|---|---|
| **Claude Code** | Reads `CLAUDE.md` automatically and finds the skill in `.claude/skills/`. Ask "use the exodiumweb-troubleshooting skill" or describe the bug. |
| **Codex CLI, OpenCode, Cursor, Aider, Gemini CLI …** | Most read `AGENTS.md` (some need it configured as a rules or context file). It points to `CLAUDE.md` and the skill. If yours has no auto-loaded file, start the session with: *"Read CLAUDE.md and .claude/skills/exodiumweb-troubleshooting/SKILL.md before doing anything."* |
| **GitHub Copilot CLI / agent** | Same `AGENTS.md`; or add `.github/copilot-instructions.md` with one line pointing at `CLAUDE.md`. Good for bounded side tasks (docs, a disjoint set of files) in parallel with a main agent. |
| **Chat-only model (no tools)** | Paste `CLAUDE.md`, the skill, and the files on the launch path; run the commands yourself and paste back the output. Slow, but the method still applies. |

What the harness must support for the full loop:

- **Shell with long-running jobs**: the detached runner already handles
  harnesses that kill child processes on restart.
- **Reading images**, for screenshot evidence. Without it, rely on
  `classify.mjs` output and `__player` state.
- **Enough context**: the instruction file is short on purpose; the agent
  reads the rest on demand. Weaker models do better when told the exact file to
  read first (see the prompt templates).

Model notes: strong coding models handle the full loop (reading minified
vendor code, designing around emulator limits). Smaller models do fine on
docs, compatibility-log updates and single-variable probe runs when given an
exact template. Keep the hard rules at the top of whatever file the model
sees first.

---

## Prompt templates

Copy, fill in, paste. They work for any harness.

**A game is broken**

```text
<Game title> (eXo shortcode <X> if known) <symptom: black screen after the
launcher menu / no sound / crashes at …>. Use the exodiumweb-troubleshooting
method (.claude/skills/exodiumweb-troubleshooting/SKILL.md). Check the
compatibility log first, reproduce with render-probe on an isolated
render-test server, change one variable at a time, fix in the server (not the
collection), prove it with probe frames, update the game's compatibility page
and run tools/compat-index.mjs. Don't deploy until I've seen the evidence.
```

**A feature or behaviour bug**

```text
<What's wrong, exact steps to reproduce>. Read docs/ARCHITECTURE.md and the
files on the launch path first. Look at stored data or server state before
theorising. Write a test in test/ that reproduces my exact steps and fails
before the fix; run it through test/run-detached.sh as render-test. Then fix,
rerun, and update ARCHITECTURE / MANUAL / compatibility Global fixes as needed.
```

**Sweep and triage**

```text
Run test/sweep.mjs for 25 random games (seed <n>) through run-detached.sh.
Triage with classify/contact first, open only flagged frames, and add each
result to docs/compatibility (one game page with front matter each), then
run tools/compat-index.mjs.
```

**Docs only**

```text
Update docs/<file> for <change>. Docs-only: no image build. Keep the house
style: short sentences, tables for reference material, no hostnames, IPs or
credentials.
```

---

## Reusing the approach for another project

The pattern, independent of eXoDOS:

1. **Proof of concept first** in a separate folder (`poc/`), with a results
   section and "findings that shape the real app". It's cheap, and it stops the
   real app being built on a wrong assumption.
2. **Keep upstream code upstream.** Copy it unchanged, replace its platform
   layer with shims, and list every local change in an `UPSTREAM.md`.
3. **An instruction file under ~80 lines**: hard rules on top, a where-to-look
   table, build/test commands, the fix workflow. Add an `AGENTS.md` pointer.
4. **A skill for the recurring hard task** (here: why a game fails), written
   from real investigations, with one fully worked case.
5. **A test harness that protects the machine** it runs on: detached, locked,
   time-limited, memory-guarded, isolated identity.
6. **Expose app state to tests** (`window.__player`) so tests assert facts,
   not pixels.
7. **A log that is the memory** (here the compatibility log), partly
   generated, updated after every test.
8. **A progress log with screenshots**, so the human can review what the
   agent did without rerunning it.
9. **Commit messages that explain why** (conventional prefix and a body), so
   `git log` answers "why is this here" for the next session.

Starter files to copy: `CLAUDE.md`, `AGENTS.md`, the skill,
`test/run-detached.sh` + `guarded-run.sh` + `memguard.sh` + `with-server.sh`,
`tools/compat-index.mjs` (as a model for a generated log), and this document.
