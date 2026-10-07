# notexoweb

A self-hosted web app for the eXo collections (eXoDOS first) that looks like
[Exodium](https://github.com/tvollstaedt/exodium) but boots games **in the
browser** with [js-dos 8](https://js-dos.com) instead of native emulators.

Status: **MVP in progress.** Screenshots and recordings per milestone:
[docs/progress](docs/progress/README.md).

## Layout

| Folder | What |
|---|---|
| `ui/` | Exodium v0.15.2 frontend, unchanged, plus `web-shims/` for the 7 Tauri modules it imports (see `ui/UPSTREAM.md`) |
| `server/` | Node server (no deps): Exodium's commands over HTTP, per-user catalogue copies, game zips from the collection, the js-dos player page |
| `test/` | Playwright screenshots, screen recordings (`record-play.mjs`) and GIF conversion |
| `poc/` | The original proof of concept |

## Run (development)

```bash
cd ui && npx pnpm@9 install && npx pnpm@9 build && cd ..
cd server && npm run fetch-data && npm run fetch-jsdos
npm run dev          # uses server/dev.env: collection over ssh, metadata copies in dev-data/
```

In production the server reads the collection from a read-only mount
(`COLLECTION_ROOT` = the eXoDOS folder holding `eXo/` and `Content/`) and takes
the user from Authelia's `Remote-User` header; see `server/src/index.mjs`.

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
- CRT shader overlay (js-dos has none built in).
- Real 3D gameplay in a 3dfx title (only the intro was reached headless).
- Aspect ratio: js-dos stretches to the container; needs `renderAspect`.

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
