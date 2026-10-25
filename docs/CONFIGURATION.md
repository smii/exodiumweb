# Configuration

The server is configured only through environment variables (read in
`server/src/index.mjs` and `server/src/collection.mjs`). There is no config
file. `npm run dev` loads `server/dev.env` (git-ignored; copy
`server/dev.env.example`) with `node --env-file-if-exists`. docker compose
reads `.env` (copy `.env.example`); the Helm chart maps its values to these
variables (`charts/exodiumweb/values.yaml`).

## Environment variables

| Variable | Default (code) | Image default (`Dockerfile`) | Meaning |
|---|---|---|---|
| `PORT` | `8080` | `8080` | HTTP listen port. |
| `COLLECTION_ROOT` | — | `/collection` | eXoDOS folder (the one holding `eXo/` and `Content/`). Read-only is fine; the server never writes there. One of `COLLECTION_ROOT` / `COLLECTION_SSH` is required, otherwise startup fails (`set COLLECTION_ROOT or COLLECTION_SSH`). |
| `COLLECTION_SSH` | — | — | Development alternative: `user@host:/path/to/eXoDOS`. Game zips and GameData zips are streamed with `ssh … cat` into `CACHE_DIR`. |
| `COLLECTION_SSH_KEY` | — | — | Private key for `COLLECTION_SSH` (`-i`, `IdentitiesOnly=yes`). |
| `COLLECTION_SSH_KNOWN_HOSTS` | — | — | `UserKnownHostsFile` for ssh (useful when the process user's home is not the key owner's). ssh runs with `BatchMode=yes`, so the host key must already be known. |
| `DEV_METADATA_DIR` | — | — | With `COLLECTION_SSH`: local folder holding copies of `!DOSmetadata.zip`, `XODOSMetadata.zip` and any content packs (random access over ssh is too slow). |
| `CACHE_DIR` | bundles/posters/reading: `server/cache`; ssh zip cache: `/tmp/exodiumweb-cache` | `/cache` | Disposable cache root. Set it explicitly so all caches land in one place. |
| `CACHE_MAX_BYTES` | `21474836480` (20 GiB) | — | ssh mode only: LRU cap for game zips fetched into `CACHE_DIR`. |
| `STATE_DIR` | `server/state` | `/state` | Per-user databases and saves. **Persistent; back it up.** |
| `MT32_DIR` | unset | `/mt32` | Folder with `MT32_CONTROL.ROM` + `MT32_PCM.ROM`. Only used for MT-32 games on the `dosboxX` backend, which the translator does not normally pick (see Troubleshooting: no MIDI synth). If set but the files are missing, a bundle build that needs them fails. |
| `USER_HEADER` | `Remote-User` | — | Request header naming the user (case-insensitive). Set by the login proxy. Ignored with `SINGLE_USER`. |
| `SINGLE_USER` | — | — | Single-user mode: every request is this user and `USER_HEADER` is ignored. For one person on localhost or a trusted LAN, with no login proxy. Anyone who reaches the port is this user. |
| `DEV_USER` | — | — | User when the header is absent. **Development only**: in production it would let anyone in as that user. |
| `MAX_BUNDLE_MB` | `4000` | — | Refuse games whose source zip is larger (HTTP 413 with a message). Browser/WASM limit. |
| `LARGE_BUNDLE_MB` | `300` | — | Above this the player asks before downloading and keeps the game in browser storage. |
| `BUNDLE_CACHE_MB` | `30000` | — | Cap for built bundles in `CACHE_DIR/bundles`; least recently used go first. |
| `UI_DIST` | `ui/dist` (repo) | `/app/ui/dist` | Built UI to serve. |
| `LOG_REQUESTS` | unset | — | Any non-empty value logs every request (`METHOD path`). |
| `NODE_ENV` | — | `production` | Set by the image; the server does not read it. |

Not configurable (hard-coded): COOP/COEP/CORP headers, the 8 MB download
piece size and 4 retries (`downloads.js`), poster width 480 px, 512 MiB save
upload limit, enabled collections (`ENABLED_COLLECTIONS = ["eXoDOS"]` in
`db.mjs`), js-dos version 8.4.1 (`server/package.json`), Exodium data tag
`v0.15.2` (`fetch-upstream-data.sh` argument).

## Per-game settings (in the UI)

Stored per user in the user's DB (`game_config`), applied at launch:

| Setting | Effect |
|---|---|
| Engine | `dosbox` / `dosboxX` forces the js-dos backend. |
| Cycles | Inserted as `cycles=` at the top of `[cpu]`. |
| Custom config | Prepended to the translated `dosbox.conf`. |
| Lock mouse | Toolbar toggle, stored in the browser (`localStorage` `exodiumweb:mouse:<id>`), not in the DB. The default comes from `/api/play/<id>` `mouseCapture`, true for the shortcodes in `MOUSE_CAPTURE_DEFAULTS` (`server/src/index.mjs`). |
| Shader | Passed to the player as `shader` (not applied by `player.html` at the moment). |

## Testing hooks (query parameters)

On `player.html?id=<id>` (passed through to `/api/play/<id>`):

| Parameter | Effect |
|---|---|
| `backend=dosbox\|dosboxX` | Force the backend. |
| `cmd=line\|line` | Replace the autoexec's commands (mounts and drive switches stay), no `exit`. |
| `tune=section.key=value\|…` | Set or replace config keys, e.g. `tune=cpu.cycles=max`. |
| `autodownload=1` | Skip the large-game question (tests). |
| `disc=<key>` | For multi-disc launchers (C&C, Red Alert): bundle only that menu choice's disc and start it directly. Without it the player asks. Ignored with `cmd=`. |

Each of these changes the config hash, so it builds a separate bundle.

## Collection layout

`COLLECTION_ROOT` must be an eXoDOS (6.04 layout) folder:

```
<COLLECTION_ROOT>/
  eXo/eXoDOS/<Game>.zip                  game zips (named after the launcher .bat in the catalogue)
  Content/!DOSmetadata.zip               eXo/eXoDOS/!dos/<shortcode>/dosbox.conf for every game (required to launch)
  Content/XODOSMetadata.zip              Images/MS-DOS/<category>/… box art and screenshots (gallery, covers; ~5 GB)
  Content/GameData/eXoDOS/<Game>.zip     optional per-game extras: manual, Videos/MS-DOS/, Music/MS-DOS/
  Content/DOSMagazines.zip, …            optional Media Pack archives (Reading Room documents)
```

- Without `!DOSmetadata.zip` no game can start (`No launch config for …`).
- Without `XODOSMetadata.zip` the app runs, but with no gallery and only the
  bundled low-resolution covers.
- The catalogue (titles, descriptions, playlists) comes from Exodium's bundled
  `exodium.db`, not from the collection. A game in the catalogue whose zip is
  missing fails at launch (`missing <Game>.zip`). The eXo configs in the
  collection always win over Exodium's bundled ones.
- The Helm chart's init check expects ≥ `collection.check.minZips` (1,000)
  zips in `eXo/eXoDOS/` and `Content/!DOSmetadata.zip`; lower it or disable it
  for a partial collection.

## Build-time inputs

| Input | Fetched by | Version |
|---|---|---|
| Exodium catalogue, eXo config zips, cover previews, licence | `server/scripts/fetch-upstream-data.sh [tag]` (`npm run fetch-data`) | `v0.15.2` |
| js-dos | `npm run fetch-jsdos` (`npm pack js-dos@8.4.1`) | `8.4.1` |
| UI | `cd ui && npx --yes pnpm@9 build` | Exodium `v0.15.2` frontend |

None of these are committed (see `.gitignore`).
