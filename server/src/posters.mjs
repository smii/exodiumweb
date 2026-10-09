// Sharp library covers (Exodium's "poster" tier). Exodium's bundled previews
// are 75x120 thumbnails, so on a modern screen the grid looked blurry next to
// the full-size gallery. A poster is the game's box front from
// XODOSMetadata.zip, scaled down to grid size once and kept in the cache;
// the UI falls back to the bundled preview when there is none.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalizeAlnum } from "./media.mjs";

// Best cover first; the gallery order puts "Box - 3D" first, which crops badly.
const PREFERRED = ["Box - Front", "Fanart - Box - Front", "Box - 3D", "Screenshot - Title", "Screenshot - Game Title", "Screenshot - Gameplay"];
const WIDTH = 480; // grid cards are up to ~240 CSS px wide; 2x for high-DPI screens
const MAX_JOBS = 3;

/** The first resizer on PATH: vipsthumbnail (image), ImageMagick (dev pod), or none. */
function findResizer() {
  const has = (cmd, arg) => spawnSync(cmd, [arg], { stdio: "ignore" }).status === 0;
  if (has("vipsthumbnail", "--version")) {
    return (src, dst) => ["vipsthumbnail", [src, "-s", `${WIDTH}x${WIDTH * 2}`, "-o", `${dst}[Q=84,strip]`]];
  }
  if (has("convert", "-version")) {
    return (src, dst) => ["convert", [`${src}[0]`, "-auto-orient", "-thumbnail", `${WIDTH}x${WIDTH * 2}>`, "-quality", "84", "-strip", `jpg:${dst}`]];
  }
  return null;
}

const run = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
  let err = "";
  p.stderr.on("data", (d) => { err += d; });
  p.on("error", reject);
  p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(0, 200)}`))));
});

export class Posters {
  /** @param {{ catalogPath: string, cacheDir: string, imageIndex: Map, metadata: () => any }} o */
  constructor({ catalogPath, cacheDir, imageIndex, metadata }) {
    this.dir = join(cacheDir, "posters");
    this.imageIndex = imageIndex;
    this.metadata = metadata;
    this.resize = findResizer();
    this.pending = new Map(); // key -> Promise<path|null>
    this.queue = [];
    this.active = 0;
    const db = new DatabaseSync(catalogPath, { readOnly: true });
    this.titles = new Map(db.prepare("SELECT thumbnail_key AS k, title FROM games WHERE thumbnail_key IS NOT NULL").all().map((r) => [r.k, r.title]));
    db.close();
    console.log(`posters: ${this.titles.size} covers, resizer ${this.resize ? this.resize("in", "out")[0] : "none (full-size images)"}`);
  }

  /** Box art entry in XODOSMetadata.zip for a cover key, or null. */
  entryFor(key) {
    const title = this.titles.get(key);
    const images = title && this.imageIndex.get(normalizeAlnum(title));
    if (!images?.length) return null;
    for (const category of PREFERRED) {
      const hit = images.find((e) => e.name.split("/")[2] === category);
      if (hit) return hit.name;
    }
    return null;
  }

  /** Path of the cached poster for a cover key, made on first use; null when the game has no art. */
  get(key) {
    if (!/^[0-9a-f]{16}$/.test(key)) return Promise.resolve(null);
    const file = join(this.dir, `${key}.jpg`);
    if (existsSync(file)) return Promise.resolve(file);
    if (!this.pending.has(key)) {
      const p = new Promise((resolve) => this.queue.push(() => this.#make(key, file).then(resolve, (e) => {
        console.error(`poster ${key}:`, e.message);
        resolve(null);
      })));
      this.pending.set(key, p);
      p.finally(() => this.pending.delete(key));
      this.#pump();
    }
    return this.pending.get(key);
  }

  #pump() {
    while (this.active < MAX_JOBS && this.queue.length) {
      this.active++;
      this.queue.shift()().finally(() => { this.active--; this.#pump(); });
    }
  }

  async #make(key, file) {
    const name = this.entryFor(key);
    const buf = name && this.metadata()?.read(name);
    if (!buf) return null;
    mkdirSync(this.dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    if (!this.resize) {
      writeFileSync(tmp, buf);
    } else {
      const src = `${tmp}.src`;
      writeFileSync(src, buf);
      try {
        const [cmd, args] = this.resize(src, `${tmp}.jpg`);
        await run(cmd, args);
        renameSync(`${tmp}.jpg`, tmp);
      } finally {
        rmSync(src, { force: true });
        rmSync(`${tmp}.jpg`, { force: true });
      }
    }
    renameSync(tmp, file);
    return file;
  }
}
