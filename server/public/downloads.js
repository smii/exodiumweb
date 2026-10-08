// Large games kept in this browser (Cache API), so a 1–2 GB CD game is
// downloaded once and then starts from local storage. Entries are keyed by the
// bundle URL (which changes with the game's config); metadata rides along in
// x-notexoweb-* headers. Used by player.html and downloads.html.
const CACHE = "notexoweb-games-v1";
const H = "x-notexoweb-";

export async function cached(url) {
  const c = await caches.open(CACHE);
  return c.match(url);
}

/** Download `url` with progress, store it, and return the Blob. */
export async function download(url, { id, title, bytes }, onProgress = () => {}) {
  // Ask the browser not to evict our storage under pressure (no prompt in
  // Chrome/Firefox for installed or frequently used sites; harmless if denied).
  navigator.storage?.persist?.().catch(() => {});
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed (HTTP ${res.status})`);
  const total = Number(res.headers.get("content-length")) || bytes || 0;
  let got = 0;
  const counted = res.body.pipeThrough(new TransformStream({
    transform(chunk, ctl) { got += chunk.length; onProgress(got, total); ctl.enqueue(chunk); },
  }));
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
    // Streamed straight to disk, never held whole in memory; the Blob read
    // back from the cache is disk-backed too.
    await c.put(url, new Response(counted, { headers }));
    const blob = await (await c.match(url)).blob();
    blob.stored = true;
    return blob;
  } catch (e) {
    // Storing can fail (quota, private window, full disk); the game still
    // runs, it is just downloaded again next time.
    console.warn("notexoweb: could not keep the download", e);
    await c.delete(url).catch(() => {});
    const again = await fetch(url);
    if (!again.ok) throw new Error(`download failed (HTTP ${again.status})`);
    const blob = await again.blob();
    blob.stored = false;
    return blob;
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
