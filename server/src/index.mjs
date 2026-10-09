// exodiumweb server: Exodium's UI over HTTP, games booted in the browser by js-dos.
//
// Env:
//   PORT                 default 8080
//   COLLECTION_ROOT      eXoDOS folder (holds eXo/ and Content/), read-only     (production)
//   COLLECTION_SSH       user@host:/path/to/eXoDOS + COLLECTION_SSH_KEY [+ _KNOWN_HOSTS] (development)
//   DEV_METADATA_DIR     local copies of Content/*.zip when using COLLECTION_SSH
//   MT32_DIR             folder with MT32_CONTROL.ROM + MT32_PCM.ROM
//   STATE_DIR            per-user databases (default server/state)
//   CACHE_DIR            ssh-mode game zip cache
//   USER_HEADER          header naming the user (default Remote-User, set by Authelia)
//   DEV_USER             user when the header is absent (development only)
//   MAX_BUNDLE_MB        refuse games whose zip is larger (default 4000, browser limit)
//   LARGE_BUNDLE_MB      above this the player asks before downloading and keeps
//                        the game in browser storage (default 300)
//   BUNDLE_CACHE_MB      server-side cap for built bundles, oldest go first (default 30000)
//   LOG_REQUESTS         log every request (debugging)
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync, rmSync, utimesSync } from "node:fs";
import { join, normalize, extname, resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { ZipReader, writeBundle } from "./zip.mjs";
import { fileURLToPath } from "node:url";
import { ensureCatalog, userDb, onUserDbOpen } from "./db.mjs";
import { voodooShortcodes, syncThreedfx } from "./curated.mjs";
import { runCommand } from "./commands.mjs";
import { gameById, gameConfig } from "./queries.mjs";
import { patchBatch, BATPATCH_VERSION } from "./batpatch.mjs";
import { ReadingCache } from "./reading.mjs";
import { Collection, zipNameFor } from "./collection.mjs";
import { translate } from "./translate.mjs";
import { buildImageIndex, GameData, typeOf } from "./media.mjs";
import { Posters } from "./posters.mjs";

const SERVER = fileURLToPath(new URL("..", import.meta.url));
const ROOT = resolve(SERVER, "..");
const env = process.env;
const PORT = Number(env.PORT ?? 8080);
const STATE_DIR = env.STATE_DIR ?? join(SERVER, "state");
const MT32_DIR = env.MT32_DIR ?? null;
const MAX_BUNDLE_MB = Number(env.MAX_BUNDLE_MB ?? 4000);
const LARGE_BUNDLE_MB = Number(env.LARGE_BUNDLE_MB ?? 300);
const BUNDLE_CACHE_MB = Number(env.BUNDLE_CACHE_MB ?? 30000);
const SOCKDRIVE_DIR = join(env.CACHE_DIR ?? join(SERVER, "cache"), "sockdrive");
const USER_HEADER = (env.USER_HEADER ?? "Remote-User").toLowerCase();
const PREVIEW_ROOT = join(SERVER, "assets", "previews");
const UI_DIST = env.UI_DIST ?? join(ROOT, "ui", "dist");
const PUBLIC = join(SERVER, "public");
const VENDOR = join(SERVER, "vendor");

const catalogPath = ensureCatalog(join(SERVER, "data"));
const collection = new Collection(env);
const t0 = Date.now();
const imageIndex = buildImageIndex(collection.metadata("XODOSMetadata.zip"));
console.log(`image index: ${imageIndex.size} titles in ${Date.now() - t0} ms`);
const voodoo = voodooShortcodes(collection.metadata("!DOSmetadata.zip"));
onUserDbOpen((db, user) => {
  const n = syncThreedfx(db, voodoo);
  if (n) console.log(`${user}: added ${n} games to 3dfx Games`);
});
const CACHE_ROOT = env.CACHE_DIR ?? join(SERVER, "cache");
const app = {
  previewRoot: PREVIEW_ROOT,
  imageIndex,
  gameData: new GameData(collection),
  reading: new ReadingCache(CACHE_ROOT, collection),
  posters: new Posters({ cacheDir: CACHE_ROOT, imageIndex, metadata: () => collection.metadata("XODOSMetadata.zip") }),
};

/** Send a whole zip entry (already in memory), honouring Range for <video>/<audio>. */
function sendBuffer(req, res, buf, type, cache) {
  const h = headers(type, { "Accept-Ranges": "bytes", "Cache-Control": cache });
  const m = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
    res.writeHead(206, { ...h, "Content-Range": `bytes ${start}-${end}/${buf.length}`, "Content-Length": end - start + 1 });
    return res.end(buf.subarray(start, end + 1));
  }
  res.writeHead(200, { ...h, "Content-Length": buf.length });
  res.end(buf);
}

// Small LRU of decoded entries so a <video> doing range requests doesn't re-inflate.
const entryCache = new Map();
function cachedEntry(key, load) {
  if (entryCache.has(key)) { const v = entryCache.get(key); entryCache.delete(key); entryCache.set(key, v); return v; }
  const v = load();
  if (v) {
    entryCache.set(key, v);
    let total = 0;
    for (const b of entryCache.values()) total += b.length;
    for (const k of entryCache.keys()) { if (total < 256 * 2 ** 20) break; total -= entryCache.get(k).length; entryCache.delete(k); }
  }
  return v;
}

/** Virtual asset paths: media:<entry in XODOSMetadata.zip>, gamedata:<gameId>/<entry>. */
async function serveVirtual(req, res, p, user) {
  if (p.startsWith("media:")) {
    const name = p.slice(6);
    if (!name.startsWith("Images/")) return false;
    const buf = cachedEntry(p, () => collection.metadata("XODOSMetadata.zip")?.read(name));
    if (!buf) return false;
    sendBuffer(req, res, buf, typeOf(name), "public, max-age=604800");
    return true;
  }
  const m = p.match(/^gamedata:(\d+)\/(.+)$/);
  if (m) {
    const game = gameById(userDb(STATE_DIR, catalogPath, user), Number(m[1]));
    const zip = game && zipNameFor(game);
    if (!zip) return false;
    const reader = await app.gameData.load(zip);
    const buf = reader && cachedEntry(p, () => reader.read(m[2]));
    if (!buf) return false;
    sendBuffer(req, res, buf, typeOf(m[2]), "private, max-age=86400");
    return true;
  }
  // Sharp library covers (posters.mjs): poster:eXoDOS/<cover key>.jpg.
  const pm = p.match(/^poster:eXoDOS\/([0-9a-f]{16})\.jpg$/);
  if (pm) {
    const file = await app.posters.get(pm[1], userDb(STATE_DIR, catalogPath, user));
    if (!file) return false;
    sendFile(req, res, file, "public, max-age=2592000");
    return true;
  }
  // Reading Room documents, extracted from their pack into the cache (reading.mjs).
  if (p.startsWith("reading:")) {
    const file = app.reading.resolve(p.slice(8));
    if (!file) return false;
    sendFile(req, res, file, "private, max-age=86400");
    return true;
  }
  return false;
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".wasm": "application/wasm", ".json": "application/json", ".zip": "application/zip", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ico": "image/x-icon", ".map": "application/json", ".pdf": "application/pdf", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
};

// Cross-origin isolation for js-dos (SharedArrayBuffer); everything is same-origin.
function headers(type, extra = {}) {
  return {
    "Content-Type": type ?? "application/octet-stream",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-origin",
    ...extra,
  };
}

function json(res, code, body) {
  res.writeHead(code, headers("application/json", { "Cache-Control": "no-store" }));
  res.end(JSON.stringify(body ?? null));
}

function sendFile(req, res, file, cache = "no-cache") {
  const st = statSync(file);
  const h = headers(TYPES[extname(file).toLowerCase()], { "Accept-Ranges": "bytes", "Cache-Control": cache });
  const m = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    res.writeHead(206, { ...h, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...h, "Content-Length": st.size });
    createReadStream(file).pipe(res);
  }
}

/** Serve `rel` from `dir`, refusing anything that escapes it. */
function serveFrom(req, res, dir, rel, cache) {
  const file = normalize(join(dir, rel));
  if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) return false;
  sendFile(req, res, file, cache);
  return true;
}

function readBody(req) {
  return new Promise((ok, fail) => {
    let s = "";
    req.on("data", (d) => { s += d; if (s.length > 1e6) req.destroy(); });
    req.on("end", () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { fail(e); } });
  });
}

function userOf(req) {
  return String(req.headers[USER_HEADER] ?? env.DEV_USER ?? "").trim() || null;
}

function tuneConf(conf, item) {
  const m = item.match(/^(\w+)\.(\w+)=(.*)$/);
  if (!m) return conf;
  const [, sec, key, val] = m;
  const lines = conf.split("\n");
  const start = lines.indexOf(`[${sec}]`);
  if (start < 0) return `${conf.replace(/\n*$/, "\n")}\n[${sec}]\n${key}=${val}\n`;
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("[")) end++;
  const at = lines.slice(start + 1, end).findIndex((l) => l.startsWith(`${key}=`));
  if (at >= 0) lines[start + 1 + at] = `${key}=${val}`;
  else lines.splice(start + 1, 0, `${key}=${val}`);
  return lines.join("\n");
}

/** Everything the player needs to boot one game for this user. */
function launchInfo(db, id, backendOverride, cmdOverride, tuneOverride) {
  const game = gameById(db, id);
  if (!game) return null;
  const conf = collection.dosboxConf(game.shortcode);
  if (!conf) return { error: `No launch config for ${game.title} in this collection` };
  const settings = gameConfig(db, id);
  // Per-game "engine" setting or ?backend= (testing) can force a js-dos backend.
  const forced = [backendOverride, settings.backend].find((b) => b === "dosbox" || b === "dosboxX");
  const t = translate(conf, { variant: game.dosbox_variant, backend: forced });
  let dosboxConf = t.conf;
  // Testing hook: ?cmd=line|line replaces the autoexec's commands (only its
  // mounts and drive switches stay), with no `exit`, so whatever the lines
  // print stays on screen.
  if (cmdOverride) {
    const [head, auto] = dosboxConf.split("[autoexec]\n");
    const kept = auto.split("\n").filter((l) => /^\s*@?((img)?mount\s|[a-z]:\s*$)/i.test(l));
    dosboxConf = `${head}[autoexec]\n${[...kept, ...cmdOverride.split("|")].join("\n")}\n`;
  }
  // Testing hook: ?tune=section.key=value|... sets/replaces config keys.
  if (tuneOverride) for (const item of tuneOverride.split("|")) dosboxConf = tuneConf(dosboxConf, item);
  if (settings.cycles) dosboxConf = dosboxConf.replace(/^\[cpu\]\n/m, `[cpu]\ncycles=${settings.cycles}\n`);
  if (settings.custom_conf) dosboxConf = `${settings.custom_conf.trim()}\n${dosboxConf}`;
  // The bundle is keyed on the exact config, so a settings change builds a new one.
  const confHash = createHash("sha1").update(dosboxConf).update(String(t.needs.mt32)).update(`bat${BATPATCH_VERSION}`).digest("hex").slice(0, 12);
  return {
    game: { id: game.id, title: game.title, year: game.year, shortcode: game.shortcode },
    backend: t.backend, conf: dosboxConf, info: t.info, needs: t.needs,
    bundleUrl: `/api/play/${id}/bundle.jsdos?${new URLSearchParams({ c: confHash, ...(backendOverride ? { backend: backendOverride } : {}), ...(cmdOverride ? { cmd: cmdOverride } : {}), ...(tuneOverride ? { tune: tuneOverride } : {}) })}`,
    confHash,
    shader: settings.glshader ?? null,
  };
}

/**
 * A js-dos bundle for one game: the collection's zip (entries copied as-is)
 * + .jsdos/dosbox.conf + MT-32 ROMs when needed. Cached on disk per config.
 */
const bundleBuilds = new Map();
async function bundleFor(game, info) {
  const dir = join(env.CACHE_DIR ?? join(SERVER, "cache"), "bundles");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${game.shortcode}-${info.confHash}.jsdos`);
  if (existsSync(out)) {
    const now = new Date();
    utimesSync(out, now, now); // LRU mark for pruneBundles
    return out;
  }
  if (!bundleBuilds.has(out)) {
    bundleBuilds.set(out, (async () => {
      const zip = await collection.gameZip(zipNameFor(game));
      // js-dos loads a whole bundle into browser memory (several copies while
      // unpacking, 4 GB WASM ceiling); ~9% of eXoDOS is over 300 MB.
      const mb = Math.round(statSync(zip).size / 1e6);
      if (mb > MAX_BUNDLE_MB) throw Object.assign(new Error(`${game.title} is ${mb} MB, too large to run in a browser (limit ${MAX_BUNDLE_MB} MB).`), { status: 413 });
      const src = new ZipReader(zip);
      const extra = [{ name: ".jsdos/dosbox.conf", data: info.conf }];
      extra.push(...patchBatchFiles(src, info.backend));
      if (info.needs.mt32 && MT32_DIR) {
        for (const rom of ["MT32_CONTROL.ROM", "MT32_PCM.ROM"]) extra.push({ name: `mt32/rev0/${rom}`, data: readFileSync(join(MT32_DIR, rom)) });
      }
      const tmp = `${out}.${process.pid}.tmp`;
      try { writeBundle(src, extra, tmp); renameSync(tmp, out); } finally { src.close(); }
      pruneBundles(dir, out);
      return out;
    })().finally(() => bundleBuilds.delete(out)));
  }
  return bundleBuilds.get(out);
}

/**
 * Keep built bundles under BUNDLE_CACHE_MB: drop the least recently used
 * (sendFile doesn't touch atime reliably, so mtime is bumped on every hit in
 * bundleFor) — big CD games are rebuilt from the collection on demand.
 */
function pruneBundles(dir, keep) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsdos"))
    .map((f) => { const p = join(dir, f); const s = statSync(p); return { p, size: s.size, t: s.mtimeMs }; })
    .sort((a, b) => a.t - b.t);
  let total = files.reduce((n, f) => n + f.size, 0);
  for (const f of files) {
    if (total <= BUNDLE_CACHE_MB * 1e6) break;
    if (f.p === keep) continue;
    rmSync(f.p, { force: true });
    total -= f.size;
    console.log(`bundle cache: removed ${f.p} (${Math.round(f.size / 1e6)} MB)`);
  }
}

/** Replacement entries for batch files js-dos can't run as-is (batpatch.mjs). */
function patchBatchFiles(src, backend) {
  const out = [];
  for (const [name, e] of src.entries) {
    if (/(^|\/)duke3d\.cfg$/i.test(name) && e.usize < 64 * 1024) {
      // eXo ships Duke at VESA 1024x768, which this emulator can't show (black screen); plain chained 320x200 works.
      const cfg = src.read(name).toString("latin1")
        .replace(/^ScreenMode\s*=.*$/m, "ScreenMode = 0").replace(/^ScreenWidth\s*=.*$/m, "ScreenWidth = 320").replace(/^ScreenHeight\s*=.*$/m, "ScreenHeight = 200");
      out.push({ name, data: Buffer.from(cfg, "latin1") });
      continue;
    }
    if (!/\.bat$/i.test(name) || e.usize > 256 * 1024) continue;
    const patched = patchBatch(src.read(name).toString("latin1"), { backend });
    if (patched !== null) out.push({ name, data: Buffer.from(patched, "latin1") });
  }
  return out;
}

/** Per-user js-dos save changes, one file per game. */
function savePath(user, game) {
  const u = user.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return join(STATE_DIR, "saves", u, `${game.shortcode}.changes`);
}

function readRaw(req, limit) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let n = 0;
    req.on("data", (d) => { n += d.length; if (n > limit) { req.destroy(); fail(new Error("too large")); } else chunks.push(d); });
    req.on("end", () => ok(Buffer.concat(chunks)));
    req.on("error", fail);
  });
}

const sseClients = new Set();
export function broadcast(event, payload) {
  const line = `data: ${JSON.stringify({ event, payload })}\n\n`;
  for (const res of sseClients) res.write(line);
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const path = decodeURIComponent(url.pathname);
  try {
    if (env.LOG_REQUESTS) console.log(`${req.method} ${path}`);
    // Liveness for the container/kubelet: no login, no collection access.
    if (path === "/healthz") return json(res, 200, { ok: true });
    const user = userOf(req);
    if (path.startsWith("/api/") && !user) return json(res, 401, { error: "not signed in" });

    if (req.method === "POST" && path.startsWith("/api/invoke/")) {
      const cmd = path.slice("/api/invoke/".length);
      const args = await readBody(req);
      const db = userDb(STATE_DIR, catalogPath, user);
      try {
        return json(res, 200, await runCommand(cmd, { db, user, app }, args));
      } catch (e) {
        return json(res, 400, { error: typeof e === "string" ? e : e?.message ?? String(e) });
      }
    }

    if (path === "/api/events") {
      res.writeHead(200, headers("text/event-stream", { "Cache-Control": "no-store", Connection: "keep-alive" }));
      res.write(": connected\n\n");
      sseClients.add(res);
      const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
      req.on("close", () => { clearInterval(ping); sseClients.delete(res); });
      return;
    }

    let m = path.match(/^\/api\/play\/(\d+)$/);
    if (m) {
      const db = userDb(STATE_DIR, catalogPath, user);
      const info = launchInfo(db, Number(m[1]), url.searchParams.get("backend"), url.searchParams.get("cmd"), url.searchParams.get("tune"));
      if (!info) return json(res, 404, { error: "unknown game" });
      if (info.error) return json(res, 422, info);
      // Build (or fetch) the bundle now: js-dos only says "500" on a failed
      // bundle download, and never tells the page, so report it from here.
      let bundle;
      try { bundle = await bundleFor(gameById(db, info.game.id), info); }
      catch (e) { console.error(`GET ${path}: ${e.message}`); return json(res, e.status ?? 502, { error: e.message }); }
      // The player asks before downloading a large game and keeps it in
      // browser storage (Cache API), keyed by bundleUrl.
      info.bundleBytes = statSync(bundle).size;
      info.large = info.bundleBytes > LARGE_BUNDLE_MB * 1e6;
      return json(res, 200, info);
    }
    m = path.match(/^\/api\/play\/(\d+)\/bundle\.jsdos$/);
    if (m) {
      const db = userDb(STATE_DIR, catalogPath, user);
      const game = gameById(db, Number(m[1]));
      const info = game && launchInfo(db, game.id, url.searchParams.get("backend"), url.searchParams.get("cmd"), url.searchParams.get("tune"));
      if (!info || info.error) return json(res, 404, { error: info?.error ?? "unknown game" });
      // Immutable per ?c=<conf hash>, so browsers can cache it hard.
      return sendFile(req, res, await bundleFor(game, info), "private, max-age=31536000, immutable");
    }

    m = path.match(/^\/api\/saves\/(\d+)$/);
    if (m) {
      const game = gameById(userDb(STATE_DIR, catalogPath, user), Number(m[1]));
      if (!game?.shortcode) return json(res, 404, { error: "unknown game" });
      const file = savePath(user, game);
      if (req.method === "GET") {
        if (!existsSync(file)) { res.writeHead(204, headers("text/plain")); return res.end(); }
        return sendFile(req, res, file, "no-store");
      }
      if (req.method === "PUT") {
        const data = await readRaw(req, 512 * 2 ** 20);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(`${file}.tmp`, data);
        renameSync(`${file}.tmp`, file);
        return json(res, 200, { saved: data.length });
      }
      if (req.method === "DELETE") {
        rmSync(file, { force: true });
        return json(res, 200, { deleted: true });
      }
    }

    if (path === "/asset") {
      // Bundled cover previews, plus the virtual paths in serveVirtual.
      const p = url.searchParams.get("path") ?? "";
      if (user && (await serveVirtual(req, res, p, user))) return;
      if (p.startsWith(PREVIEW_ROOT + "/") && serveFrom(req, res, PREVIEW_ROOT, p.slice(PREVIEW_ROOT.length), "public, max-age=604800")) return;
      res.writeHead(404, headers("text/plain")); return res.end("not found");
    }
    // Streamed game drives (sockdrive.mjs). A miss must be a real 404: the
    // SPA fallback below would hand js-dos index.html as disk data.
    if (path.startsWith("/sockdrive/")) {
      return serveFrom(req, res, SOCKDRIVE_DIR, path.slice(11), "public, max-age=86400") || json(res, 404, { error: "no such range" });
    }
    if (path.startsWith("/mt32/") && MT32_DIR && serveFrom(req, res, MT32_DIR, path.slice(6), "public, max-age=604800")) return;
    if (path.startsWith("/vendor/") && serveFrom(req, res, VENDOR, path.slice(8), "public, max-age=86400")) return;
    if (["/player.html", "/downloads.html", "/downloads.js"].includes(path) && serveFrom(req, res, PUBLIC, path.slice(1))) return;

    // The UI build (single-page app).
    if (serveFrom(req, res, UI_DIST, path === "/" ? "index.html" : path.slice(1), path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache")) return;
    if (!path.startsWith("/api/") && serveFrom(req, res, UI_DIST, "index.html")) return;
    res.writeHead(404, headers("text/plain")); res.end("not found");
  } catch (e) {
    console.error(`${req.method} ${path}:`, e);
    if (!res.headersSent) json(res, 500, { error: String(e?.message ?? e) });
    else res.end();
  }
}).listen(PORT, () => console.log(`exodiumweb on :${PORT} (catalogue ${catalogPath})`));
