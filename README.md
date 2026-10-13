# (Unofficial) ExodiumWeb

A self-hosted web app for the eXo collections (eXoDOS first): browse the whole
eXoDOS library and play the games **in your browser**, no emulator to install.

![Library: 7,666 games, with the hover info panel open](docs/screenshots/library.png)

*Unofficial: not affiliated with the Exodium project or the eXo team. The
Exodium UI is used under its MIT licence (`ui/UPSTREAM-LICENSE`).*

Status: **MVP in progress.** Screenshots and recordings per milestone:
[docs/progress](docs/progress/README.md).

## Where it comes from

I just wanted something selfhosted rather then running an desktop app ;)


ExodiumWeb is based on [**Exodium**](https://github.com/tvollstaedt/exodium)
by tvollstaedt(Kudoes to you!!!), a desktop launcher for the eXo collections built with Tauri
(SolidJS frontend, Rust backend) that starts games in native emulators such as
DOSBox.

This project took Exodium and refactored it into a **web app**, with AI coding
assistants (Claude Code and GitHub Copilot) doing most of the
refactoring under human direction:

| Exodium (desktop) | ExodiumWeb (browser) |
|---|---|
| Tauri app, installed per machine | One server, any browser on the network |
| Rust backend (~100 Tauri commands) | Dependency-free Node server answering the same commands over HTTP |
| Native DOSBox / DOSBox-X | [js-dos 8](https://js-dos.com) (DOSBox compiled to WebAssembly) in the browser; each game's own eXo `dosbox.conf` translated on the fly |
| Single user, local files | Per-user libraries, favourites and saves |

The Exodium UI itself is kept almost unchanged; small `web-shims/` stand in
for the Tauri modules it imports. Hence the name: Exodium, as a web app,
**ExodiumWeb**.

## Screenshots

| | |
|---|---|
| ![Game detail with box art, video and gallery](docs/screenshots/detail.png) | ![Commander Keen 5 running in the browser](docs/screenshots/playing.png) |
| Game detail: description, box art, video, gallery, manual | Commander Keen 5 running in the browser with js-dos |

![Reading Room with eXo's magazines](docs/screenshots/reading-room.png)

Reading Room: eXo's magazines, books and catalogues, read in the browser.

Retake them with `test/readme-shots.mjs` (Playwright; see the header comment).

## Quick start

You need your own copy of the **eXoDOS collection** (6.04 layout: the folder
holding `eXo/` and `Content/`). Nothing from it is in this repo or the image.
The browser must reach the app over **HTTPS or `localhost`** (the player needs
`SharedArrayBuffer`).

### Docker

```bash
docker build -t exodiumweb .
docker run -d --name exodiumweb -p 127.0.0.1:8080:8080 \
  -v /path/to/eXoDOS:/collection:ro \
  -v exodiumweb-state:/state -v exodiumweb-cache:/cache \
  -e SINGLE_USER=player \
  exodiumweb
```

Open <http://localhost:8080>.

### docker compose

```bash
cp .env.example .env          # set EXODOS_PATH; SINGLE_USER=player by default
docker compose up -d --build
```

[`compose.yaml`](compose.yaml) binds to `127.0.0.1:8080` and keeps per-user
state and the bundle cache in named volumes.

### Helm (Kubernetes)

Build and push the image to a registry your cluster can pull from, then:

```bash
helm install exodiumweb charts/exodiumweb -n exodiumweb --create-namespace \
  --set image.repository=registry.example.com/exodiumweb --set image.tag=0.1 \
  --set collection.hostPath=/mnt/exodos \
  --set ingress.enabled=true --set ingress.host=exo.example.com
```

The collection can be a `hostPath`, an `nfs` share or an existing PVC. For
users, set either `auth.singleUser` or a login proxy in `ingress.annotations`.
All options are in [`charts/exodiumweb/values.yaml`](charts/exodiumweb/values.yaml).

### Users and login

The app has no login of its own. Pick one:

- **Single user** (`SINGLE_USER=<name>`): everyone who reaches the app is that
  user. Fine on `localhost` or a trusted LAN, never on the internet.
- **Login proxy** (several users, each with their own library and saves):
  leave `SINGLE_USER` empty and put Authelia, oauth2-proxy, Authentik or any
  forward-auth proxy in front. It must set the `Remote-User` header
  (`USER_HEADER` to rename it) and overwrite any value the client sends.

Details, sizing, backup and upgrades: [docs/DEPLOY.md](docs/DEPLOY.md).
Every setting: [docs/CONFIGURATION.md](docs/CONFIGURATION.md).
Internals: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Layout

| Folder | What |
|---|---|
| `ui/` | Exodium v0.15.2 frontend, unchanged, plus `web-shims/` for the 7 Tauri modules it imports (see `ui/UPSTREAM.md`) |
| `server/` | Node server (no deps): Exodium's commands over HTTP, per-user catalogue copies, game zips from the collection, the js-dos player page |
| `charts/exodiumweb/` | Helm chart |
| `compose.yaml`, `.env.example` | docker compose setup |
| `deploy/` | The author's own homelab build Job (kaniko → Harbor); an example, not needed elsewhere |
| `test/` | Playwright screenshots (`readme-shots.mjs` for the README), screen recordings (`record-play.mjs`) and GIF conversion |
| `poc/` | The original proof of concept |

## Run (development)

Needs Node >= 22.13.

```bash
cd ui && npx pnpm@9 install && npx pnpm@9 build && cd ..
cd server && npm run fetch-data && npm run fetch-jsdos
cp dev.env.example dev.env    # point COLLECTION_ROOT (or COLLECTION_SSH) at your collection
npm run dev                   # http://localhost:8090
```

Game graphics, launch configuration and isolated browser diagnostics:
[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md). Includes the Tomb Raider
white-intro/missing-text diagnosis and a non-3dfx fallback.

## Proof of concept (2026-10-07)

`poc/` boots original eXoDOS game zips from the NAS with js-dos 8.4.1,
self-hosted, using each game's own eXo `dosbox.conf` translated on the fly.

| Piece | File |
|---|---|
| eXo conf → js-dos translator (pure function) | `poc/server/translate.mjs` |
| Test server (no deps; COOP/COEP headers, range requests) | `poc/server/server.mjs` |
| Test list + player pages | `poc/public/index.html`, `poc/public/play.html` |
| Headless boot test (Playwright) | `poc/test/boot-test.mjs`, `poc/test/test-3dfx.mjs` |
| Copy test games / confs / MT-32 ROMs from the NAS (read-only) | `poc/tools/fetch_games.sh` |
| Conf survey, test-game picker, translate-all check | `poc/tools/*.py`, `poc/tools/translate_all.mjs` |

### Results

- **10/10 test games boot**: plain EGA/CGA, floppy image (`imgmount`), MT-32
  (DOSBox-X + eXo's ROMs), Gravis Ultrasound, IPX config, booter disk, PCjr/Tandy,
  Commander Keen 5, Wing Commander (CD image + MT-32), and Furcol in 3dfx mode
  (`glfx enabled`, intro at ~85 % speed on software WebGL).
- The translator handles all 7,666 eXoDOS 6.04 configs: 6,919 → `dosbox`,
  747 → `dosboxX` (MT-32 / Voodoo / DOSBox-X titles), no host path left unconverted.

### Findings that shape the real app

1. **The NAS has eXoDOS 5.0** (`eXo/Update/ver`), 4,496 of 7,666 game zips
   (~320 GB). Exodium bundles 6.04 configs that can differ from 5.0 zips
   (Guillermo Tell: 6.04 calls a `run.bat` only 6.04 zips contain). → Always use
   the **collection's own** `!dos/<game>/dosbox.conf`; the catalogue should come
   from the collection's own LaunchBox XML (see exogui's `GameParser.ts`).
2. eXo's `voodoo=true` is a template default in ~430 configs; real 3dfx titles
   (30 in 6.04) are the ones with bilinear filtering on / `voodoo=opengl`.
3. Games with a separate 3dfx executable (Furcol: `FUR3DFX.BAT`) need an
   "alternate launch" choice in the UI. `?cmd=` on the launch API is the test hook.
4. `.ba1` files in every zip are eXo leftovers; ignore them.
5. The NAS's `eXo/util` has no eXo tools (only `GBC`), so nothing may depend on
   eXo's Windows launch scripts.

### Not yet tested

- IPX multiplayer between two browsers (js-dos WebRTC-NET).
- CRT shader overlay (js-dos has none built in); scanlines are a CSS overlay aligned to the canvas by `alignScan` in `player.html`.
- Real 3D gameplay in a 3dfx title (Furcol renders; Tomb Raider Gold's accelerated path has a white intro and missing menu text, despite rendering some demo scenes; Blood, Descent II, Shadow Warrior reach menus via `test/dfx-probe.mjs`; Shadow Warrior 3DFX hits a wasm `unreachable` headless, unverified). Quake's zip has no GLQuake/Glide build, so no 3dfx.
- Aspect ratio: js-dos stretches to the container; needs `renderAspect`.

### Recent behaviour notes

- Downloads fetch 8 MB `Range` pieces (4 retries) then `caches.put` (single requests cut off at ~14 MB via Traefik HTTP/2).
- Translator: `svga_s3` → `vesa_nolfb`, `memsize` capped at 63 for dosbox; Duke3D `duke3d.cfg` forced to `ScreenMode=0` (`BATPATCH_VERSION=5`).
- Player `close()` timeouts: save 8 s, stop 3 s, 15 s backstop. Testing hook: `?tune=section.key=value|...`.

## Run the PoC

```bash
bash poc/tools/fetch_games.sh poc/data/picks.txt poc/games   # copies ~72 MB from the NAS
node poc/server/server.mjs 8090                                # http://localhost:8090
cd poc/test && npm install
bash fetch-chromium-libs.sh        # only in containers without Chromium's libs
npx playwright install chromium
LD_LIBRARY_PATH=$PWD/.libs node boot-test.mjs http://localhost:8090
```

`poc/data/` holds Exodium's bundled catalogue and configs (MIT,
`poc/data/EXODIUM-LICENSE`). Game zips, ROMs and NAS configs are not committed.

## Related analysis

- Exodium: Tauri 2 (SolidJS + Rust), MIT; ~100 backend calls isolated in
  `src/api/tauri.ts`, so it's the UI base.
- exogui (eXo's own Linux/macOS GUI): Electron + React, MIT, reads LaunchBox XML
  live; renderer uses Node APIs directly, so it's a poor UI base, but
  `src/shared/game/GameParser.ts` + media path helpers are worth reusing for
  catalogue import from the NAS.
