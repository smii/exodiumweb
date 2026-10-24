# (Unofficial) ExodiumWeb

## The No-AI Generated Introduction Section

Hi All,

As a big fan of the [eXoDOS](https://www.retro-exo.com/exodos.html) community and the [Exodium](https://github.com/tvollstaedt/exodium) launcher, I wanted to bring these projects along on my self-hosted journey. I also wanted to see how I could utilize the capabilities of Claude (Opus 5.5), which ultimately resulted in this project. I honestly didn't expect transforming Exodium into a self-hosted (Cloud Native) service to be this functional so quickly.

Current features:
*   Many games are working already, though I can't guarantee everything. I'm currently compiling a compatibility list through automated and manual playtesting,
*   There is a functional UI, including support for save games.
*   Ingame settings bar ingame to adjust Graphical, HiD, Cycle settings. 
*  'CRT Overlay'  (Sorry couldn't hold myself ;). It's just an visual layer on top of the picture: no blur etc.
*   Large games will be entirely downloaded before running. For some (like Command & Conquer), I've added campaign options at launch to minimize the download size.  Downloads are per game removable in the UI.
*   I've started doing automated testing using Claude, including several approaches to try and fix games on the fly, with the results being pushed back to the compatibility list.
*   For games that needed fixes, don't worry: your local library remains untouched. The fixes are included directly in the commits.
*   I did not yet included networking, due to my very limited time.


Additionally  I tried to make the whole process from idea -> building as extensivly  which can be found in the docs.  In case this project enables others to contribute, re-use or build an even better platform! Last but not lease fingers crossed that the future brings better DOS support to the browser. 

A big thanks to @tvollstaedt for his work and suggestions to make this better! And of course, I can't forget the entire eXoDOS community for all their effort!


## What it is

**Browse the whole eXoDOS library and play the games in your browser.**
Self-hosted, multi-user, nothing to install on the client.

![Library: 7,666 games, with the hover info panel open](docs/screenshots/library.png)

| ![Game detail with box art, video and gallery](docs/screenshots/detail.png) | ![Commander Keen 5 running in the browser](docs/screenshots/playing.png) | ![Reading Room with eXo's magazines](docs/screenshots/reading-room.png) |
|---|---|---|
| Game detail: box art, video, gallery, manual | Commander Keen 5 in js-dos | Reading Room: eXo's magazines and books |

- **The whole eXoDOS 6.04 catalogue**, with search, genres, playlists, box art, videos and manuals.
- **Games run in the browser** with [js-dos 8](https://js-dos.com) (DOSBox in WebAssembly). The server translates each game's own eXo `dosbox.conf` and launcher on the fly.
- **Per-user** libraries, favourites and saves behind your login proxy, or a single user on a trusted LAN.
- **Your collection stays untouched.** It is mounted read-only, and every fix is applied to a cached copy.
- Big games download in pieces and stay in the browser. For multi-disc launchers, such as C&C and Red Alert, you pick one campaign and only that disc is downloaded.

Status: **MVP in progress.** Milestones with screenshots: [docs/progress](docs/progress/README.md).

## Tested games

The headless test plays each game up to a menu or into the game. Every tested game has its own page with the fixes made for it.
Overview, global fixes and how to add a game: **[docs/compatibility](docs/compatibility/README.md)**.

<!-- generated:tested (node tools/compat-index.mjs) -->
🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟨🟨🟨🟨🟨🟨🟨🟨🟧🟥 **34 of 7,666 games tested:** 🟢 17 playable · 🟡 15 boots · 🟠 1 partial · 🔴 1 not supported. [All tested games](docs/compatibility/GAMES.md) · [searchable table](docs/compatibility/games.csv)
<!-- /generated:tested -->

A game misbehaving? [Open an issue](https://github.com/smii/exodiumweb/issues/new/choose) with the game's name. The app's bug button and **Settings → About** link to the same place.

## Quick start

You need your own **eXoDOS 6.04 collection**: the folder that holds `eXo/` and `Content/`. None of it ships with this repo or the image.
The browser must reach the app over **HTTPS or `localhost`**, because the player needs `SharedArrayBuffer`.

```bash
docker build -t exodiumweb .
docker run -d --name exodiumweb -p 127.0.0.1:8080:8080 \
  -v /path/to/eXoDOS:/collection:ro \
  -v exodiumweb-state:/state -v exodiumweb-cache:/cache \
  -e SINGLE_USER=player exodiumweb          # → http://localhost:8080
```

<details>
<summary><b>docker compose</b> and <b>Helm</b></summary>

```bash
cp .env.example .env          # set EXODOS_PATH
docker compose up -d --build  # binds 127.0.0.1:8080, named volumes for state + cache
```

```bash
helm install exodiumweb charts/exodiumweb -n exodiumweb --create-namespace \
  --set image.repository=registry.example.com/exodiumweb --set image.tag=0.1 \
  --set collection.hostPath=/mnt/exodos \
  --set ingress.enabled=true --set ingress.host=exo.example.com
```

The collection can be a `hostPath`, an `nfs` share or an existing PVC. All options are in [`values.yaml`](charts/exodiumweb/values.yaml).
</details>

**Users:** the app has no login of its own.
- `SINGLE_USER=<name>` makes everyone that user. Use it only on `localhost` or a trusted LAN.
- For several users, leave it empty and put a forward-auth proxy in front (Authelia, oauth2-proxy, Authentik). The proxy must set `Remote-User` (`USER_HEADER` renames it) and overwrite any value the client sends.

## Docs

| | |
|---|---|
| [MANUAL](docs/MANUAL.md) | Using the app: library, playing, saves, downloads, troubleshooting for players |
| [DEPLOY](docs/DEPLOY.md) | Sizing, login proxies, backup, upgrades |
| [CONFIGURATION](docs/CONFIGURATION.md) | Every setting and URL parameter (`?disc=`, `?cmd=`, `?tune=`) |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Server, config translation, launcher patching, bundles, downloads |
| [TROUBLESHOOTING](docs/TROUBLESHOOTING.md) | Black screens, graphics and audio, the headless probe (`test/render-probe.mjs`) |
| [compatibility](docs/compatibility/README.md) | Overview of tested games, full A–Z list and searchable table, fix per game, global fixes |
| [progress](docs/progress/README.md) | Milestones with screenshots and recordings |
| [AI-ASSISTED-DEVELOPMENT](docs/AI-ASSISTED-DEVELOPMENT.md) | How it was built with Claude Code; agent kit, test harness, debugging method, deploy loop, reuse with other agents |
| [CLAUDE.md](CLAUDE.md) · [skill](.claude/skills/exodiumweb-troubleshooting/SKILL.md) | For AI coding agents (also read via [AGENTS.md](AGENTS.md)): rules, layout, the game-debugging method |

## Development

Needs Node ≥ 22.13.

```bash
cd ui && npx pnpm@9 install && npx pnpm@9 build && cd ..
cd server && npm run fetch-data && npm run fetch-jsdos
cp dev.env.example dev.env    # point COLLECTION_ROOT (or COLLECTION_SSH) at your collection
npm run dev                   # http://localhost:8090
```

| Folder | What |
|---|---|
| `ui/` | Exodium v0.15.2 frontend plus `web-shims/` for the 7 Tauri modules it imports. Local changes are listed in [`ui/UPSTREAM.md`](ui/UPSTREAM.md). |
| `server/` | Dependency-free Node server: Exodium's commands over HTTP, per-user SQLite, bundles built from the collection, the js-dos player |
| `charts/exodiumweb/`, `compose.yaml` | Helm chart and docker compose setup |
| `test/` | Playwright: README screenshots, recordings, the detached render probe (`run-detached.sh`) |
| `deploy/` | The author's own homelab build Job (kaniko → Harbor); an example only |
| `poc/` | The original proof of concept and its findings ([poc/README.md](poc/README.md)) |

## Where it comes from

ExodiumWeb is [**Exodium**](https://github.com/tvollstaedt/exodium) by tvollstaedt, made into a web app. Exodium is a Tauri desktop launcher for the eXo collections (SolidJS + Rust) that starts games in a native DOSBox. Kudos for the great frontend!
I wanted something self-hosted instead of a desktop app. AI coding assistants (Claude Code and GitHub Copilot) did most of the refactoring under human direction:

| Exodium (desktop) | ExodiumWeb (browser) |
|---|---|
| Tauri app, installed per machine | One server, any browser on the network |
| Rust backend (~100 Tauri commands) | Node server answering the same commands over HTTP |
| Native DOSBox / DOSBox-X | js-dos 8 in the browser |
| Single user, local files | Per-user libraries, favourites and saves |

*Unofficial: not affiliated with the Exodium project or the eXo team. The Exodium UI is used under its MIT licence (`ui/UPSTREAM-LICENSE`). Bugs in ExodiumWeb belong in [this repo's issues](https://github.com/smii/exodiumweb/issues), not upstream.*
