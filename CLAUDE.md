# CLAUDE.md — ExodiumWeb

Instructions for AI coding agents (Claude Code, Copilot, Codex …) working in
this repo. Humans: start with [README.md](README.md). Kept short; detail lives
in `docs/`.

## Hard rules
- **Never write to the eXoDOS collection.** It is read-only input. Every fix
  is applied to the cached bundle (`server/src/batpatch.mjs`, `translate.mjs`,
  `discs.mjs`), never to the source zips or configs.
- **Never touch a real user's state or saves.** Test as `DEV_USER=render-test`
  with a separate `STATE_DIR`; don't call a production API with a test user
  header (it creates a user DB there).
- **One browser test at a time**, only through `test/run-detached.sh` (it has
  a memory guard; Chromium needs ~5× a game's bundle size).
- No game files, ROMs, credentials, hostnames or IPs in git.
- `ui/` is Exodium's frontend, kept close to upstream. Browser stand-ins go
  in `ui/web-shims/`; any edit to `ui/src` is listed in `ui/UPSTREAM.md`.

## Where things are
| Need | Go to |
|---|---|
| How the server, bundles and player fit | `docs/ARCHITECTURE.md` |
| Settings and URL parameters (`backend`, `cmd`, `tune`, `disc`, `autodownload`) | `docs/CONFIGURATION.md` |
| A game misbehaves | skill `.claude/skills/exodiumweb-troubleshooting`, `docs/TROUBLESHOOTING.md` |
| Tested games, fix per game, global fixes | `docs/compatibility/` |
| What players see and do | `docs/MANUAL.md` |
| Install and operate | `docs/DEPLOY.md` |
| History with screenshots | `docs/progress/README.md` |
| How it was built with an agent; the whole dev/test/deploy machinery, for reuse | `docs/AI-ASSISTED-DEVELOPMENT.md` |

## Working on a game
1. Read its page in `docs/compatibility/games/` and the **Global fixes** table.
2. Reproduce with the render probe, change one variable at a time.
3. Fix in the server (batch patch / translator / bundle), bump
   `BATPATCH_VERSION` for batch-only changes so cached bundles rebuild.
4. Update the game's page (its front matter holds the status), then `node tools/compat-index.mjs`.
5. Milestone-sized changes also get an entry in `docs/progress/README.md`.

## Build and test
- UI: `cd ui && npx --yes pnpm@9 build` (typecheck: `npx tsc --noEmit -p .`).
- Server: Node ≥ 22.13, no dependencies; `cd server && npm run dev`.
- Image: `docker build -t exodiumweb .`. Everything shipped must come from the
  `Dockerfile`; edits under ignored `server/vendor/` don't ship.
- Commit messages: conventional (`fix(cnc): …`, `docs(readme): …`), a body
  that says why.
