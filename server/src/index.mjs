// notexoweb server: Exodium's UI over HTTP, games booted in the browser by js-dos.
//
// Env:
//   PORT                 default 8080
//   COLLECTION_ROOT      eXoDOS folder (holds eXo/ and Content/), read-only     (production)
//   COLLECTION_SSH       user@host:/path/to/eXoDOS + COLLECTION_SSH_KEY         (development)
//   DEV_METADATA_DIR     local copies of Content/*.zip when using COLLECTION_SSH
//   MT32_DIR             folder with MT32_CONTROL.ROM + MT32_PCM.ROM
//   STATE_DIR            per-user databases (default server/state)
//   CACHE_DIR            ssh-mode game zip cache
//   USER_HEADER          header naming the user (default Remote-User, set by Authelia)
//   DEV_USER             user when the header is absent (development only)
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureCatalog, userDb } from "./db.mjs";
import { runCommand } from "./commands.mjs";
import { gameById, gameConfig } from "./queries.mjs";
import { Collection, zipNameFor } from "./collection.mjs";
import { translate } from "./translate.mjs";

const SERVER = fileURLToPath(new URL("..", import.meta.url));
const ROOT = resolve(SERVER, "..");
const env = process.env;
const PORT = Number(env.PORT ?? 8080);
const STATE_DIR = env.STATE_DIR ?? join(SERVER, "state");
const MT32_DIR = env.MT32_DIR ?? null;
const USER_HEADER = (env.USER_HEADER ?? "Remote-User").toLowerCase();
const PREVIEW_ROOT = join(SERVER, "assets", "previews");
const UI_DIST = env.UI_DIST ?? join(ROOT, "ui", "dist");
const PUBLIC = join(SERVER, "public");
const VENDOR = join(SERVER, "vendor");

const catalogPath = ensureCatalog(join(SERVER, "data"));
const collection = new Collection(env);
const app = { previewRoot: PREVIEW_ROOT };

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

/** Everything the player needs to boot one game for this user. */
function launchInfo(db, id) {
  const game = gameById(db, id);
  if (!game) return null;
  const conf = collection.dosboxConf(game.shortcode);
  if (!conf) return { error: `No launch config for ${game.title} in this collection` };
  const settings = gameConfig(db, id);
  const t = translate(conf, { variant: game.dosbox_variant });
  let dosboxConf = t.conf;
  if (settings.cycles) dosboxConf = dosboxConf.replace(/^\[cpu\]\n/m, `[cpu]\ncycles=${settings.cycles}\n`);
  if (settings.custom_conf) dosboxConf = `${settings.custom_conf.trim()}\n${dosboxConf}`;
  const files = [{ kind: "zip", url: `/api/play/${id}/game.zip` }];
  if (t.needs.mt32 && MT32_DIR) {
    for (const rom of ["MT32_CONTROL.ROM", "MT32_PCM.ROM"]) files.push({ kind: "file", path: `mt32/rev0/${rom}`, url: `/mt32/${rom}` });
  }
  return {
    game: { id: game.id, title: game.title, year: game.year, shortcode: game.shortcode },
    backend: t.backend, conf: dosboxConf, info: t.info, files,
    shader: settings.glshader ?? null,
  };
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
      const info = launchInfo(userDb(STATE_DIR, catalogPath, user), Number(m[1]));
      return info ? json(res, info.error ? 422 : 200, info) : json(res, 404, { error: "unknown game" });
    }
    m = path.match(/^\/api\/play\/(\d+)\/game\.zip$/);
    if (m) {
      const game = gameById(userDb(STATE_DIR, catalogPath, user), Number(m[1]));
      const zip = game && zipNameFor(game);
      if (!zip) return json(res, 404, { error: "unknown game" });
      return sendFile(req, res, await collection.gameZip(zip), "private, max-age=86400");
    }

    if (path === "/asset") {
      // Only the bundled cover previews are reachable this way.
      const p = url.searchParams.get("path") ?? "";
      if (p.startsWith(PREVIEW_ROOT + "/") && serveFrom(req, res, PREVIEW_ROOT, p.slice(PREVIEW_ROOT.length), "public, max-age=604800")) return;
      res.writeHead(404, headers("text/plain")); return res.end("not found");
    }
    if (path.startsWith("/mt32/") && MT32_DIR && serveFrom(req, res, MT32_DIR, path.slice(6), "public, max-age=604800")) return;
    if (path.startsWith("/vendor/") && serveFrom(req, res, VENDOR, path.slice(8), "public, max-age=86400")) return;
    if (path === "/player.html" && serveFrom(req, res, PUBLIC, "player.html")) return;

    // The UI build (single-page app).
    if (serveFrom(req, res, UI_DIST, path === "/" ? "index.html" : path.slice(1), path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache")) return;
    if (!path.startsWith("/api/") && serveFrom(req, res, UI_DIST, "index.html")) return;
    res.writeHead(404, headers("text/plain")); res.end("not found");
  } catch (e) {
    console.error(`${req.method} ${path}:`, e);
    if (!res.headersSent) json(res, 500, { error: String(e?.message ?? e) });
    else res.end();
  }
}).listen(PORT, () => console.log(`notexoweb on :${PORT} (catalogue ${catalogPath})`));
