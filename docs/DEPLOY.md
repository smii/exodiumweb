# Deploying exodiumweb elsewhere

How to run exodiumweb on another machine or cluster: plain Docker, docker
compose (`compose.yaml`), Kubernetes with the Helm chart
(`charts/exodiumweb/`), plus a note on the author's own homelab flow. Variable
reference: [CONFIGURATION.md](CONFIGURATION.md). Internals:
[ARCHITECTURE.md](ARCHITECTURE.md).

## What you need

| Need | Detail |
|---|---|
| eXoDOS collection (6.04 layout) | Mounted **read-only** at `/collection`. Must hold `eXo/eXoDOS/*.zip`, `Content/!DOSmetadata.zip` (required to launch anything) and `Content/XODOSMetadata.zip` (box art; ~5 GB, optional but recommended). Optional: `Content/GameData/eXoDOS/*.zip`, Media Pack zips. You supply it; the image contains none of it. |
| `/state` volume | Per-user databases and saves. Persistent, **back it up**. A few GB at most (~20 MB per user + saves). |
| `/cache` volume | Built game bundles, posters, reading-room extracts. Disposable; bounded by `BUNDLE_CACHE_MB` (default 30000 = ~30 GB). |
| Login proxy *or* single-user mode | Several users: a proxy that authenticates them and sets the `Remote-User` header (Authelia, oauth2-proxy, Authentik, Caddy/Traefik/nginx forward-auth, ...). One person on localhost or a trusted LAN: `SINGLE_USER=<name>` instead, no proxy. |
| HTTPS | The browser must reach the app in a **secure context** (HTTPS or `localhost`). The player needs `SharedArrayBuffer` (the server sends COOP/COEP headers; do not strip them), AudioWorklet and the Cache API (large games are kept in browser storage). Over plain HTTP on a LAN hostname the player breaks. |
| Optional `/mt32` | `MT32_CONTROL.ROM` + `MT32_PCM.ROM`, only for MT-32 games on the dosboxX backend. Skip it normally. |

The container runs as user `node` (uid/gid 1000), listens on **8080**, needs
no outbound network at runtime and no root.

## Security: the Remote-User header

The server does **no authentication**. With `SINGLE_USER` set it ignores the
header and treats every request as that user, so anyone who can reach the port
*is* that user: keep it on `127.0.0.1` or a network you trust. Without
`SINGLE_USER`: it trusts the `Remote-User` header
(`USER_HEADER` to rename) as the identity: anyone who can reach port 8080
directly can send `Remote-User: someone` and read or overwrite that user's
saves and library.

- Never publish 8080 on a public or shared network. Bind it to
  `127.0.0.1` / a private docker network / a ClusterIP Service and expose only
  the proxy.
- The proxy must **overwrite or strip** any client-supplied `Remote-User` and
  set it from its own authenticated session; reject unauthenticated requests.
- `/healthz` needs no login (probes only).
- Do **not** set `DEV_USER` in production; it logs everyone in as that user
  when the header is missing.
- Keep the collection mount `:ro`; the server never writes there.

## Build

Prebuilt images are not published; build from the repo root (the Dockerfile
builds everything: UI with pnpm 9, Exodium catalogue `v0.15.2`, js-dos 8.4.1;
needs internet at build time only).

```bash
docker build -t exodiumweb:$(git rev-parse --short HEAD) .
docker tag exodiumweb:$(git rev-parse --short HEAD) exodiumweb:latest
```

Without Docker, the UI build alone is `cd ui && npx --yes pnpm@9 install
--frozen-lockfile && npx --yes pnpm@9 build`; the server then needs
`npm run fetch-data && npm run fetch-jsdos` in `server/` and Node >= 22.13
(see README, "Run (development)"). Push to your registry as usual
(`docker push registry.example.com/exodiumweb:<tag>`).

## Plain Docker

```bash
docker run -d --name exodiumweb --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -v /path/to/eXoDOS:/collection:ro \
  -v exodiumweb-state:/state \
  -v exodiumweb-cache:/cache \
  -e BUNDLE_CACHE_MB=20000 \
  -e SINGLE_USER=player \
  --memory 1g \
  exodiumweb:latest
```

Named volumes are created owned by uid 1000 on first use. If you bind-mount
host directories for `/state` and `/cache`, `chown 1000:1000` them first.
Open <http://localhost:8080>. For several users drop `SINGLE_USER` and put your
TLS + login proxy in front of `127.0.0.1:8080`.

## docker compose

The repo ships [`compose.yaml`](../compose.yaml), driven by a `.env` file:

```bash
cp .env.example .env      # EXODOS_PATH=/path/to/eXoDOS, SINGLE_USER=player
docker compose up -d --build
```

| `.env` key | Default | Meaning |
|---|---|---|
| `EXODOS_PATH` | (required) | Host path of the eXoDOS folder, mounted read-only at `/collection`. |
| `SINGLE_USER` | empty | Single-user mode; leave empty behind a login proxy. |
| `BIND_ADDRESS` / `PORT` | `127.0.0.1` / `8080` | Host address and port to publish on. |
| `BUNDLE_CACHE_MB`, `MAX_BUNDLE_MB`, `LARGE_BUNDLE_MB`, `USER_HEADER` | see CONFIGURATION.md | Passed through to the server. |
| `MEM_LIMIT` | `1g` | Container memory limit. |
| `IMAGE` | `exodiumweb:local` | Image name to build/tag (or a prebuilt one from your registry). |

State and cache live in the named volumes `state` and `cache`. To put a
login proxy in front, add it as a service on the same compose network, leave
`SINGLE_USER` empty and have the proxy forward to `exodiumweb:8080` with
`Remote-User` set (and remove the `ports:` mapping so only the proxy can
reach the app).

## Kubernetes (Helm chart)

[`charts/exodiumweb/`](../charts/exodiumweb) deploys a single-replica
Deployment (`Recreate`, per-user SQLite files), a ClusterIP Service, PVCs for
`/state` and `/cache`, an optional Ingress and an init container that refuses
to start on an empty collection mount. The pod runs as uid/gid 1000 with all
capabilities dropped.

```bash
docker build -t registry.example.com/exodiumweb:0.1 . && docker push registry.example.com/exodiumweb:0.1

helm install exodiumweb charts/exodiumweb -n exodiumweb --create-namespace -f my-values.yaml
```

```yaml
# my-values.yaml
image:
  repository: registry.example.com/exodiumweb
  tag: "0.1"
# imagePullSecrets: [{ name: registry-credentials }]
collection:
  nfs: { server: nas.example.lan, path: /exports/eXoDOS }
  # or hostPath: /mnt/exodos   (the node must have it mounted)
  # or existingClaim: exodos   (a PVC for an NFS/SMB share)
  check:
    minZips: 1000              # lower for a partial collection, or enabled: false
auth:
  userHeader: Remote-User      # set by the proxy configured below
  # singleUser: player         # instead of a proxy, one-person setups only
persistence:
  state: { size: 2Gi }         # kept on `helm uninstall` (resource-policy: keep)
  cache: { size: 25Gi }        # keep above config.bundleCacheMB
config:
  bundleCacheMB: 20000
ingress:
  enabled: true
  className: nginx
  host: exo.example.com
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
    # Your login layer MUST set Remote-User (forward-auth / auth-url +
    # response headers) and overwrite any client-sent value. Controller-specific.
```

Without an Ingress, try it with
`kubectl -n exodiumweb port-forward svc/exodiumweb 8080:8080` and
<http://localhost:8080> (needs `auth.singleUser`, or every API call answers
401). Do not open a path to the Service from untrusted namespaces; the header
trust applies to every in-cluster caller too.

## First run

1. The image already contains the eXoDOS-only catalogue (`catalog.db`, built at
   image build time), so there is no import step.
2. A user's first request copies the catalogue to `/state/users/<user>.db`
   (~20 MB, takes a moment). Then Library, favourites and saves are per user.
3. Nothing is pre-built: the first launch of each game builds its bundle from
   the zip into `/cache/bundles` (seconds to minutes, depending on size and
   storage speed); later launches are instant. Covers are generated lazily
   into `/cache/posters`.
4. Check: `curl http://127.0.0.1:8080/healthz` returns 200 (no login, does not
   touch the collection); then open the site through the proxy.

## Sizing

- **Server memory**: 128 Mi request / **1 Gi limit** has been enough; bundles
  are built by streaming zip entries, the 8 MB download pieces and poster
  jobs (max 3 concurrent) are small. Raise the limit if you raise
  `MAX_BUNDLE_MB` and see OOM kills during builds of very large games.
- **MAX_BUNDLE_MB** (default 2000): games whose source zip is larger are
  refused with HTTP 413. The real ceiling is the *browser*: js-dos loads the
  whole bundle as one ArrayBuffer, and a 3.5 GB game fails to allocate it
  (Police Quest: SWAT). Lowering it protects weak clients.
  **LARGE_BUNDLE_MB** (300) is the threshold above which the player asks
  before downloading and stores the game in the browser.
- **Disk**: `BUNDLE_CACHE_MB` caps `/cache/bundles` (LRU); posters add
  ~300 MB. Size the cache volume a few GB above the cap, and keep the cap
  below the real free space (some provisioners do not enforce PVC sizes).
- **CPU**: building bundles is the burst; 1-2 cores is plenty. Emulation runs
  in the user's browser, not on the server.

## Health check

`GET /healthz` always returns 200. The image has a `HEALTHCHECK` (30 s) using
it; use it for readiness/liveness as above. It does not prove the collection
is mounted, hence the init-container check on Kubernetes (on plain Docker, an
empty mount shows up as "No launch config" / "missing ...zip" at launch).

## Backup

Back up **`/state`** only: `users/<user>.db` (+ `-wal`, `-shm`) and
`saves/<user>/*.changes`. `/cache` is rebuilt on demand; the collection is
yours already.

```bash
# consistent enough for saves; stop the container for a perfectly clean copy
docker run --rm -v exodiumweb-state:/state:ro -v "$PWD":/backup busybox \
  tar czf /backup/exodiumweb-state-$(date +%F).tgz -C /state .
```

Restore by extracting into an empty `/state` (owner uid 1000) before starting.

## Upgrade and rollback

1. Build a new tag, point the deployment/compose file at it, restart. `/state`
   is compatible across versions; take a backup first anyway.
2. Cache invalidation is automatic: the bundle name is a hash of the config,
   translator output and `BATPATCH_VERSION` (`server/src/batpatch.mjs`).
   When a release bumps `BATPATCH_VERSION` (or changes the translator), games
   are rebuilt on next launch under new URLs and browsers re-download; old
   bundles age out by LRU (or `rm -rf /cache/bundles/*` to reclaim now).
3. Rollback: redeploy the previous tag. Its bundles have different hashes, so
   it rebuilds its own; no state migration to undo unless you restored
   a backup. Keep the previous image tag until the new one is verified.
4. The Exodium catalogue is pinned in the image (`v0.15.2`), so catalogue
   changes only come with a new build.

## The author's homelab (k3s + ArgoCD + kaniko)

For reference only; do not copy the specifics.

- Manifests live in the homelab repo under `k8s-manifests/exodiumweb/`
  (Deployment, PVCs, Ingress), tracked by an ArgoCD Application; the image
  tag in `deployment.yaml` is bumped to upgrade.
- The image is built on the node by a one-off kaniko Job
  (`deploy/build-job.yaml`) that reads the checkout via hostPath and pushes
  to the internal Harbor project `homelab/exodiumweb`; the kubelet pulls it
  from Harbor's external hostname.
- The collection is a host-level read-only SMB mount of the NAS, handed to the
  pod as a read-only hostPath; the init container guards against it being
  down.
- Authelia forward-auth provides `Remote-User`; the Ingress chain is
  error-pages, internal-only (or public by choice), HTTPS redirect, then
  forward-auth.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Startup: `set COLLECTION_ROOT or COLLECTION_SSH` | Env missing; the image sets `COLLECTION_ROOT=/collection`, so you overrode it or run outside the image. |
| Library empty / `No launch config for ...` | `Content/!DOSmetadata.zip` missing, or the collection mount is empty/wrong path (mount the folder that holds `eXo/` and `Content/`). |
| `missing <Game>.zip` at launch | Partial collection: game is in the catalogue but not in `eXo/eXoDOS/`. |
| No box art / gallery, only tiny covers | `Content/XODOSMetadata.zip` missing. |
| Pod `Init:CrashLoopBackOff` (check-collection) | Collection volume not mounted, `Content/!DOSmetadata.zip` missing or fewer zips than `collection.check.minZips`; lower it for a partial collection. |
| Everyone is the same user / `401`-style behaviour | Proxy not setting `Remote-User` (or `USER_HEADER` mismatch); check what header reaches the app with `LOG_REQUESTS=1` and the proxy config. |
| Anyone can impersonate users | Port 8080 reachable without the proxy, or proxy forwards client-sent `Remote-User`. See Security. |
| Player stuck / `SharedArrayBuffer is not defined`, no audio, large games don't persist | Not a secure context (plain HTTP on a non-localhost name), or a proxy strips `Cross-Origin-*` headers. Use HTTPS. |
| HTTP 413 on a game | Source zip larger than `MAX_BUNDLE_MB`. |
| `EACCES` writing `/state` or `/cache` | Volume not owned by uid 1000 (`chown 1000:1000`, or `fsGroup: 1000` on Kubernetes). |
| Pod `OOMKilled` | Raise the memory limit, lower `MAX_BUNDLE_MB`; check you are not building several huge games at once. |
| `/cache` fills the disk | Lower `BUNDLE_CACHE_MB`; some storage classes do not enforce volume size. |
| Games behave differently after an upgrade | Intended: `BATPATCH_VERSION` bump rebuilt the bundle; hard-refresh the browser. |
| Cover images missing | `vipsthumbnail` missing (custom image); the bundled 75x120 previews are used instead. |
| Saves gone for a user | `/state` was not persistent (check the volume), or the user name changed (saves are keyed by `Remote-User`, sanitised to `[a-zA-Z0-9_.-]`). |
| Slow first launch of a game | Bundle is being built; the second launch is cached. Slow storage under `/cache` or the collection is the usual cause. |
