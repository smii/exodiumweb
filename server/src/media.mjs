// Box art / screenshots (XODOSMetadata.zip) and per-game extras: manual,
// video, theme music (Content/GameData/eXoDOS/<game>.zip). Paths handed to
// the UI are virtual ("media:..." / "gamedata:<id>/..."); /asset resolves them.
import { ZipReader } from "./zip.mjs";

// Gallery order, best art first (Exodium's IMAGE_CATEGORY_ORDER).
const CATEGORY_ORDER = [
  "Box - 3D", "Box - Front", "Box - Back", "Box - Spine", "Cart - Front", "Cart - Back", "Disc", "Clear Logo",
  "Screenshot - Gameplay", "Screenshot - Title", "Screenshot - Game Title", "Screenshot - Game Select",
  "Screenshot - Game Over", "Screenshot - High Scores", "Fanart - Box - Front", "Fanart - Background",
  "Fanart - Disc", "Advertisement Flyer - Front", "Advertisement Flyer - Back", "Poster", "Banner", "Arcade - Marquee",
];
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export const normalizeAlnum = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const stripSuffixNum = (stem) => stem.replace(/-\d+$/, "");

/** Index Images/MS-DOS/<category>/[region/]<Title>-NN.ext by normalised title. */
export function buildImageIndex(zip, platform = "MS-DOS") {
  const index = new Map();
  if (!zip) return index;
  const prefix = `Images/${platform}/`;
  for (const name of zip.names()) {
    if (!name.startsWith(prefix) || !IMAGE_EXT.test(name)) continue;
    const parts = name.slice(prefix.length).split("/");
    const category = parts[0];
    const rank = CATEGORY_ORDER.indexOf(category);
    if (rank < 0) continue;
    const stem = parts[parts.length - 1].replace(IMAGE_EXT, "");
    const key = normalizeAlnum(stripSuffixNum(stem));
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({ rank, name });
  }
  for (const list of index.values()) list.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return index;
}

export function imagesFor(index, title) {
  return (index.get(normalizeAlnum(title)) ?? []).map((e) => `media:${e.name}`);
}

const TYPES = { pdf: "application/pdf", txt: "text/plain; charset=utf-8", html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
  mp4: "video/mp4", webm: "video/webm", ogg: "audio/ogg", mp3: "audio/mpeg", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
export const typeOf = (name) => TYPES[name.split(".").pop().toLowerCase()] ?? "application/octet-stream";

/**
 * Per-game GameData access with a fetch state machine the UI can poll
 * (Exodium's VideoStatus shape: phase fetching|ready|none|error).
 */
export class GameData {
  constructor(collection) {
    this.collection = collection;
    this.state = new Map(); // zipName -> { phase, error, reader }
  }

  status(zipName) {
    return this.state.get(zipName) ?? null;
  }

  /** Start (or reuse) loading a game's GameData zip; resolves with its reader or null. */
  load(zipName) {
    let s = this.state.get(zipName);
    if (s?.promise) return s.promise;
    s = { phase: "fetching", error: null, reader: null };
    s.promise = this.collection.gameDataZip(zipName)
      .then((path) => {
        if (!path) { s.phase = "none"; return null; }
        s.reader = new ZipReader(path);
        s.phase = "ready";
        return s.reader;
      })
      .catch((e) => { s.phase = "error"; s.error = String(e.message ?? e); return null; });
    this.state.set(zipName, s);
    return s.promise;
  }

  /** First entry under `dir` (e.g. "Videos/MS-DOS/") whose name ends with one of `exts`. */
  static find(reader, dir, exts) {
    if (!reader) return null;
    for (const n of reader.names()) {
      if (n.startsWith(dir) && exts.some((x) => n.toLowerCase().endsWith(x))) return n;
    }
    return null;
  }
}
