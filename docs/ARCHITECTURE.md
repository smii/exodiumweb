# Architecture

exodiumweb is one container: a dependency-free Node server (`server/`) that
serves Exodium's unchanged web UI (`ui/`), answers the UI's backend calls over
HTTP, builds js-dos game bundles from a **read-only** eXoDOS collection, and
keeps per-user state on its own disk.

```
Browser ──HTTPS──▶ login proxy (sets Remote-User) ──HTTP──▶ exodiumweb :8080
  │                                                          │
  │  UI (SolidJS, /)                                         ├─ /collection  eXoDOS, read-only
  │  player.html in an <iframe> → js-dos 8.4.1 (WASM)        ├─ /state       per-user DBs + saves
  │  Cache API: large games kept in the browser              └─ /cache       bundles, posters, docs
```

## Components

| Component | Where | What it does |
|---|---|---|
| Exodium UI | `ui/` (v0.15.2, MIT) | The desktop app's SolidJS frontend, copied unchanged (`ui/UPSTREAM.md`). |
| Web shims | `ui/web-shims/` + alias block in `ui/vite.config.ts` | Replace the 7 Tauri modules the UI imports. `invoke(cmd, args)` → `POST /api/invoke/<cmd>`; `listen()` → `EventSource('/api/events')`; `launch_game` opens the player overlay. Also: history/Back handling (`history.ts`), hover panel (`hovercard.ts`), phone layout and look (`web.css`), Downloads link. |
| Server | `server/src/index.mjs` | HTTP routes, launch info, bundle building and caching, saves, static files. Node ≥ 22.13 built-ins only (`node:sqlite`, `node:zlib`, `node:http`). |
| Command table | `server/src/commands.mjs`, `queries.mjs` | Exodium's Tauri commands reimplemented over the user's SQLite DB. Desktop-only features (torrents, seeding, storage, updater, setup wizard) return harmless "nothing to do" values; unknown commands are logged once and return `null`. |
| Player | `server/public/player.html` | Loads `/api/play/<id>`, starts js-dos (`/vendor/js-dos/`), syncs saves, toolbar (scanlines, mouse lock, keyboard lock, fullscreen, close). |
| Downloads | `server/public/downloads.js`, `downloads.html` | Download-once storage for large games (Cache API) and the page that lists/removes them. |
| js-dos 8.4.1 | `server/vendor/js-dos/` (fetched by `npm run fetch-jsdos`) | The emulator: two backends, `dosbox` and `dosboxX`. |
| js-dos 8.5.3 | `server/vendor/js-dos-3dfx/` (same script) | Only for 3dfx launches (`dosboxX` + Voodoo): 8.4.1's Voodoo renderer kept stale textures. |
| Upstream data | `server/data/`, `server/assets/previews/` (fetched by `npm run fetch-data`) | Exodium's bundled catalogue `exodium.db`, eXo config zips and 75×120 cover thumbnails. |

## Request flow

| Path | Handler |
|---|---|
| `GET /healthz` | Always 200, no login, no collection access (probe target). |
| `POST /api/invoke/<command>` | JSON args → `runCommand` → JSON result, or `400 {error}` (the shim rethrows it as a string, like Tauri). |
| `GET /api/events` | Server-sent events stream for `listen()`. `broadcast()` exists but nothing calls it at the moment; the shim's `emit()` handles `game-exited` locally. |
| `GET /api/play/<id>` | Launch info: translated `dosbox.conf`, backend, bundle URL, size, `large` flag. Builds the bundle first so errors (missing zip, too large) reach the page as JSON instead of a js-dos "500". |
| `GET /api/play/<id>/bundle.jsdos?c=<hash>` | The built bundle, `Range` supported, `Cache-Control: immutable` (the URL changes with the config). |
| `GET/PUT/DELETE /api/saves/<id>` | The user's js-dos "changes" blob for that game (PUT limit 512 MiB). |
| `GET /asset?path=…` | Virtual media paths (below) and bundled previews. |
| `/player.html`, `/downloads.html`, `/downloads.js` | `server/public/`. |
| `/vendor/…`, `/mt32/…`, `/sockdrive/…` | js-dos files, MT-32 ROMs (if `MT32_DIR`), sockdrive ranges. |
| everything else | `ui/dist`, with SPA fallback to `index.html` (not for `/api/`). |

Every `/api/*` request without a user (see `USER_HEADER`) gets `401`. Every
response carries `Cross-Origin-Opener-Policy: same-origin`,
`Cross-Origin-Embedder-Policy: require-corp` and
`Cross-Origin-Resource-Policy: same-origin` (js-dos needs cross-origin
isolation for `SharedArrayBuffer`); all assets are same-origin.

## Users, catalogue and saves

- **Identity** is the `Remote-User` header (configurable) set by the login
  proxy. The server does no authentication of its own and trusts the header
  as-is. `SINGLE_USER` replaces it outright (one-person setups without a
  proxy); `DEV_USER` fills in when the header is missing (development).
- **Catalogue**: at startup (or image build) `db.mjs:ensureCatalog` turns
  `data/exodium.db` into `data/catalog.db`: only eXoDOS rows
  (`ENABLED_COLLECTIONS`), every game marked installed (so the UI shows
  **Play**), library/favourites/config cleared.
- **Per-user DB**: the first request from a user copies `catalog.db` to
  `$STATE_DIR/users/<user>.db` (~20 MB) and opens it in WAL mode. Favourites,
  playlists, recently played, per-game settings and Reading Room state live in
  the same tables Exodium uses, so the query code is a straight port. User names
  are sanitised to `[a-zA-Z0-9_.-]`.
- **3dfx playlist**: on each DB open `curated.mjs` adds every game whose eXo
  config enables a real 3dfx card to eXo's "3dfx Games" playlist (29 → 36).
- **Saves**: js-dos keeps a game's changed files as one blob. The player
  pulls it from `/api/saves/<id>` on start and pushes it on close/autosave;
  stored at `$STATE_DIR/saves/<user>/<shortcode>.changes`. Saves follow the
  user to any browser; another user starts clean.
- **Quitting saves too**: a game quit from its own menu ends in the launcher's
  `exit`, which would stop the emulator, and js-dos can't save after that.
  `translate.mjs`/`batpatch.mjs` turn every `exit` into `X:\EXOQUIT.COM`, a
  4-byte idle program on a drive of its own (`exoweb/` in the bundle); the
  player polls `ci.getRunningProgram()`, and when it reports `EXOQUIT` it
  saves and closes as if Close was pressed. Test: `test/test-dos-save.mjs`.

## Bundles

A js-dos bundle (`.jsdos`) is a zip. For each launch:

1. `translate.mjs` reads the game's own `eXo/eXoDOS/!dos/<shortcode>/dosbox.conf`
   from the collection's `Content/!DOSmetadata.zip` and rewrites it for js-dos:
   - drops host-only sections/keys (SDL, render, joystick, Staging/ECE-only
     keys, Windows host paths) and rewrites `.\eXoDOS\…` mount paths;
   - picks the backend: `dosboxX` only for 3dfx configs or eXo's DOSBox-X
     variants, everything else (MT-32 games included) runs on `dosbox`;
   - forces all mixer/sound-chip rates to 44,100 Hz (see Troubleshooting);
   - `machine=svga_s3` → `vesa_nolfb` (dosbox), `vesa_noflb` typo → `vesa_nolfb`,
     `memsize` capped at 63;
   - MIDI devices fall back to `default`; adds `[voodoo] voodoo_card=opengl`
     for 3dfx on DOSBox-X.
2. Per-game settings (`cycles`, custom conf lines, engine) and the testing
   hooks (`?backend=`, `?cmd=`, `?tune=`) are applied.
3. The config hash (`sha1(conf + mt32 flag + BATPATCH_VERSION)`, 12 chars)
   names the bundle: `$CACHE_DIR/bundles/<shortcode>-<hash>.jsdos`. Any change
   to the config, the translator output or `BATPATCH_VERSION` produces a new
   bundle and a new URL (so browsers re-download).
4. `zip.mjs:writeBundle` writes the game zip's entries **byte-for-byte, still
   compressed** (no re-deflate), then extra stored entries:
   `.jsdos/dosbox.conf`, patched batch files, MT-32 ROMs when needed. All
   directory entries come first, parents before children (js-dos's extractor
   needs that). ZIP64 is used where needed.
5. `batpatch.mjs` rewrites launcher `.bat` files (≤ 256 KB): `IF cond program`
   → `IF cond GOTO` + labels; `CONFIG -set mididevice=…` commented out on
   DOSBox-X; menu lines offering MT-32/Sound Canvas get " (no music)". Also
   `duke3d.cfg` is forced to 320×200 (`ScreenMode = 0`).
   Launcher `imgmount`/`mount` lines get the same `.\eXoDOS\…` path
   rewrite as the autoexec (`BATPATCH_VERSION` 8; C&C and Red Alert mount
   their CDs from `run.bat`).
   **Disc choice** (`discs.mjs`): when a launcher's menu choices start from
   different CD images and the bundle is over `LARGE_BUNDLE_MB`,
   `/api/play/<id>` returns `discs: [{key,label,bytes}]` and no bundle URL.
   The player asks which campaign to play and asks again with `?disc=<key>`.
   That bundle leaves out every other disc the launcher mounts, and its
   `run.bat` jumps straight to the choice (`choice` → `goto <label>`) and
   mounts only that disc. `disc<key>` is part of the config hash.
6. Concurrent requests for the same bundle share one build. After a build,
   bundles are pruned least-recently-used (mtime bumped on each hit) down to
   `BUNDLE_CACHE_MB`.

Games whose zip is larger than `MAX_BUNDLE_MB` are refused with `413` and a
message (js-dos loads the whole bundle as one ArrayBuffer in browser memory;
a 3.5 GB game fails to allocate it).

## Downloads (large games)

- Bundles ≤ `LARGE_BUNDLE_MB` (300 MB): js-dos fetches the bundle URL directly.
- Larger: the player asks first, then `downloads.js` fetches it in **8 MB
  `Range` pieces** (4 tries each, back-off) as disk-backed Blobs, joins them
  and stores the result with `caches.put` in Cache `exodiumweb-games-v1`, keyed
  by bundle URL. Older versions of the same game are deleted. Next start comes
  from browser storage. `navigator.storage.persist()` is requested.
- If storing fails (quota, private window) the game still runs and downloads
  again next time. The Cache API needs a secure context (HTTPS or localhost).
- `/downloads.html` lists stored games with sizes, **Remove** and **Remove all**.

## Media

| UI feature | Source | Virtual path |
|---|---|---|
| Gallery (box art, screenshots) | `Content/XODOSMetadata.zip`, `Images/MS-DOS/<category>/…`, indexed by normalised title at startup | `media:Images/…` |
| Library covers ("posters") | Best box front from the same zip, scaled to 480 px wide by `vipsthumbnail` (or ImageMagick `convert`; unscaled if neither), max 3 jobs at once, cached in `$CACHE_DIR/posters/<key>.jpg`. Falls back to the bundled 75×120 preview. | `poster:eXoDOS/<key>.jpg` |
| Manual, video, theme music | Per-game `Content/GameData/eXoDOS/<game>.zip`, opened once per game | `gamedata:<id>/<entry>` |
| Reading Room documents | eXo Media Pack zips (`Content/DOSMagazines.zip` etc.), extracted on first open into `$CACHE_DIR/reading/` | `reading:<file>` |

`/asset` honours `Range` (for `<video>`/`<audio>`); a 256 MB LRU keeps decoded
zip entries in memory. The Reading Room catalogue (publications, issues,
"covered in" articles) comes from Exodium's DB and is always browsable; opening
an issue needs the pack in the collection (on hold, see `ROADMAP.md`).

## Data directories

| Path | Contents | Lifetime |
|---|---|---|
| `$COLLECTION_ROOT` | eXoDOS collection | read-only, never written |
| `$STATE_DIR/users/<user>.db` (+ `-wal`, `-shm`) | per-user catalogue copy | **keep / back up** |
| `$STATE_DIR/saves/<user>/<shortcode>.changes` | per-user saves | **keep / back up** |
| `$CACHE_DIR/bundles/` | built `.jsdos` bundles | disposable, LRU at `BUNDLE_CACHE_MB` |
| `$CACHE_DIR/posters/` | 480 px covers (~40 KB each, ~300 MB for all games) | disposable |
| `$CACHE_DIR/reading/` | extracted Reading Room documents | disposable |
| `$CACHE_DIR/sockdrive/` | sockdrive ranges (spike only, `tools/make-test-drive.sh`) | disposable |
| `$CACHE_DIR/*.zip`, `gamedata/` | game zips fetched over ssh (dev mode only), LRU at `CACHE_MAX_BYTES` | disposable |
| `server/data/catalog.db` | eXoDOS-only catalogue (built into the image) | rebuilt from `exodium.db` |

## Sockdrive (spike)

`server/src/sockdrive.mjs` writes a raw disk image as a js-dos "sockdrive v2"
static drive (256 KiB ranges fetched on demand); `/sockdrive/` serves them.
Only used by `tools/make-test-drive.sh` so far; the game flow does not use it.
