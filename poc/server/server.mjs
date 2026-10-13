// PoC server: serves the test page, js-dos, game zips and translated confs.
// No dependencies. Usage: node server/server.mjs [port]
import { createServer } from "node:http";
import { createReadStream, readFileSync, statSync, existsSync } from "node:fs";
import { join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { translate } from "./translate.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8090);
// The collection's own configs (games/confs, copied from the NAS) win: they
// match the zips' eXo version. Exodium's bundled 6.04 configs are a fallback.
const CONF_DIRS = [join(ROOT, "games/confs"), join(ROOT, "data/confs/eXo/eXoDOS/!dos")];
const GAMES = JSON.parse(readFileSync(join(ROOT, "data/games.json"), "utf8"));
const byShort = new Map(GAMES.map((g) => [g.short, g]));

const STATIC = [
  ["/vendor/", join(ROOT, "vendor/")],
  ["/games/zips/", join(ROOT, "games/zips/")],
  ["/games/mt32/", join(ROOT, "games/mt32/")],
  ["/", join(ROOT, "public/")],
];

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".wasm": "application/wasm", ".json": "application/json",
  ".zip": "application/zip", ".png": "image/png", ".woff": "font/woff", ".map": "application/json",
};

// Cross-origin isolation: js-dos needs SharedArrayBuffer for its worker and
// DOSBox-X builds; everything is same-origin, so require-corp is free.
function baseHeaders(type) {
  return {
    "Content-Type": type ?? "application/octet-stream",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "no-cache",
  };
}

function sendJson(res, code, body) {
  res.writeHead(code, baseHeaders("application/json"));
  res.end(JSON.stringify(body));
}

function serveFile(req, res, file) {
  const st = statSync(file);
  const headers = { ...baseHeaders(TYPES[extname(file).toLowerCase()]), "Accept-Ranges": "bytes" };
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : st.size - 1;
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "Content-Length": st.size });
  createReadStream(file).pipe(res);
}

// Test hook: replace the autoexec's start command (the last line before
// `exit`), e.g. ?cmd=call FUR3DFX to launch a game's 3dfx executable.
function overrideCommand(conf, cmd) {
  const [head, auto] = conf.split("[autoexec]\n");
  const lines = auto.trimEnd().split("\n");
  const exitAt = lines.findLastIndex((l) => /^\s*@?exit\s*$/i.test(l));
  lines[(exitAt > 0 ? exitAt : lines.length) - 1] = cmd;
  return `${head}[autoexec]\n${lines.join("\n")}\n`;
}

function launchInfo(short, backendOverride, cmd) {
  const game = byShort.get(short);
  const confFile = CONF_DIRS.map((d) => join(d, short, "dosbox.conf")).find((f) => existsSync(f));
  if (!game || !confFile) return null;
  const t = translate(readFileSync(confFile, "latin1"), {
    variant: game.variant,
    backend: backendOverride === "dosbox" || backendOverride === "dosboxX" ? backendOverride : undefined,
  });
  const files = [{ kind: "zip", url: `/games/zips/${encodeURIComponent(short)}.zip` }];
  if (t.needs.mt32) {
    for (const rom of ["MT32_CONTROL.ROM", "MT32_PCM.ROM"]) {
      files.push({ kind: "file", path: `mt32/rev0/${rom}`, url: `/games/mt32/rev0/${rom}` });
    }
  }
  return { game, backend: t.backend, conf: cmd ? overrideCommand(t.conf, cmd) : t.conf, info: t.info, files };
}

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const path = decodeURIComponent(url.pathname);
  if (path === "/api/games") return sendJson(res, 200, GAMES);
  const m = path.match(/^\/api\/games\/([^/]+)\/launch$/);
  if (m) {
    const info = launchInfo(m[1], url.searchParams.get("backend"), url.searchParams.get("cmd"));
    return info ? sendJson(res, 200, info) : sendJson(res, 404, { error: "unknown game" });
  }
  for (const [prefix, dir] of STATIC) {
    if (!path.startsWith(prefix)) continue;
    let file = normalize(join(dir, path.slice(prefix.length) || "index.html"));
    if (!file.startsWith(dir)) break; // path traversal
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (existsSync(file)) return serveFile(req, res, file);
  }
  res.writeHead(404, baseHeaders("text/plain"));
  res.end("not found");
}).listen(PORT, () => console.log(`exodiumweb PoC on http://localhost:${PORT}`));
