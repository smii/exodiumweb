// Large games kept in this browser (Cache API), so a 1–2 GB CD game is
// downloaded once and then starts from local storage. Entries are keyed by the
// bundle URL (which changes with the game's config); metadata rides along in
// x-exodiumweb-* headers. Used by player.html and downloads.html.
const CACHE = "exodiumweb-games-v1";
const H = "x-exodiumweb-";

export async function cached(url) {
  const c = await caches.open(CACHE);
  return c.match(url);
}

/** Download `url` with progress, store it, and return the Blob. */
export async function download(url, { id, title, bytes }, onProgress = () => {}) {
  // Ask the browser not to evict our storage under pressure (no prompt in
  // Chrome/Firefox for installed or frequently used sites; harmless if denied).
  navigator.storage?.persist?.().catch(() => {});
  // Fetched in 8 MB Range pieces: on the live site one long streamed response
  // was cut off after ~14 MB (browser -> Traefik/HTTP2) and never finished. Each
  // piece is retried on its own, and the pieces are Blobs (disk-backed), so the
  // whole game is never held in JS memory.
  const head = await fetch(url, { cache: "no-store", headers: { Range: "bytes=0-0" } });
  if (!head.ok) throw new Error(`download failed (HTTP ${head.status})`);
  const total = Number(head.headers.get("content-range")?.split("/")[1]) || Number(head.headers.get("content-length")) || bytes || 0;
  await head.arrayBuffer();
  const PIECE = 8 * 1024 * 1024;
  const parts = [];
  let got = 0;
  while (got < total) {
    const end = Math.min(got + PIECE, total) - 1;
    let piece;
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await fetch(url, { cache: "no-store", headers: { Range: `bytes=${got}-${end}` } });
        if (r.status !== 206) throw new Error(`HTTP ${r.status}`);
        piece = await r.blob();
        if (piece.size !== end - got + 1) throw new Error("short piece");
        break;
      } catch (e) {
        if (attempt >= 4) throw new Error(`download failed at ${fmtBytes(got)} (${e.message})`);
        await new Promise((ok) => setTimeout(ok, 500 * attempt));
      }
    }
    parts.push(piece);
    got += piece.size;
    onProgress(got, total);
  }
  const whole = new Blob(parts, { type: "application/zip" });
  const headers = {
    "content-type": "application/zip",
    "content-length": String(total),
    [`${H}id`]: String(id),
    [`${H}title`]: encodeURIComponent(title),
    [`${H}date`]: new Date().toISOString(),
  };
  const c = await caches.open(CACHE);
  // One copy per game: drop versions built from an older config.
  for (const e of await list()) if (e.id === id && e.url !== url) await c.delete(e.url);
  try {
    await c.put(url, new Response(whole, { headers }));
    const blob = await (await c.match(url)).blob();
    blob.stored = true;
    return blob;
  } catch (e) {
    // Storing can fail (quota, private window, full disk); the game still
    // runs, it is just downloaded again next time.
    console.warn("exodiumweb: could not keep the download", e);
    await c.delete(url).catch(() => {});
    whole.stored = false;
    return whole;
  }
}

export async function list() {
  const c = await caches.open(CACHE);
  const out = [];
  for (const req of await c.keys()) {
    const r = await c.match(req);
    if (!r) continue;
    out.push({
      url: req.url,
      id: Number(r.headers.get(`${H}id`)),
      title: decodeURIComponent(r.headers.get(`${H}title`) ?? "?"),
      bytes: Number(r.headers.get("content-length")) || 0,
      date: r.headers.get(`${H}date`),
    });
  }
  return out.sort((a, b) => b.bytes - a.bytes);
}

export async function remove(url) {
  return (await caches.open(CACHE)).delete(url);
}

export async function clear() {
  return caches.delete(CACHE);
}

export const fmtBytes = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`);
