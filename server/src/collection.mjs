// Access to the eXo collection, read-only.
//
// Production: the collection is a (read-only) mount, COLLECTION_ROOT points at
// the eXoDOS folder (the one holding eXo/ and Content/).
// Development: COLLECTION_SSH="user@host:/path/to/eXoDOS" streams game zips
// over ssh into CACHE_DIR, and the two metadata archives are read from
// DEV_METADATA_DIR (local copies), since random access over ssh is too slow.
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, readdirSync, unlinkSync, utimesSync } from "node:fs";
import { join, basename } from "node:path";
import { ZipReader } from "./zip.mjs";

export class Collection {
  constructor(env) {
    this.root = env.COLLECTION_ROOT || null;
    this.ssh = env.COLLECTION_SSH || null;
    this.sshKey = env.COLLECTION_SSH_KEY || null;
    this.sshKnownHosts = env.COLLECTION_SSH_KNOWN_HOSTS || null;
    this.cacheDir = env.CACHE_DIR || "/tmp/notexoweb-cache";
    this.cacheMax = Number(env.CACHE_MAX_BYTES || 20 * 2 ** 30);
    this.devMetadata = env.DEV_METADATA_DIR || null;
    if (!this.root && !this.ssh) throw new Error("set COLLECTION_ROOT or COLLECTION_SSH");
    this.inflight = new Map();
    this._zips = new Map();
  }

  /** A metadata archive under Content/ (e.g. "!DOSmetadata.zip"), opened once. */
  metadata(name) {
    if (!this._zips.has(name)) {
      const path = this.root ? join(this.root, "Content", name) : join(this.devMetadata, name);
      this._zips.set(name, existsSync(path) ? new ZipReader(path) : null);
    }
    return this._zips.get(name);
  }

  /** The launch config for a game, from the collection's own !DOSmetadata.zip. */
  dosboxConf(shortcode) {
    const buf = this.metadata("!DOSmetadata.zip")?.read(`eXo/eXoDOS/!dos/${shortcode}/dosbox.conf`);
    return buf ? buf.toString("latin1") : null;
  }

  /** Local path of a game zip (eXo/eXoDOS/<name>.zip); fetched into the cache in ssh mode. */
  async gameZip(zipName) {
    if (zipName.includes("/") || zipName.includes("\\") || zipName.startsWith(".")) throw new Error("bad zip name");
    if (this.root) {
      const p = join(this.root, "eXo", "eXoDOS", zipName);
      if (!existsSync(p)) throw new Error(`missing ${zipName}`);
      return p;
    }
    mkdirSync(this.cacheDir, { recursive: true });
    const cached = join(this.cacheDir, zipName);
    if (existsSync(cached)) {
      const now = new Date();
      utimesSync(cached, now, now); // LRU by mtime
      return cached;
    }
    if (!this.inflight.has(zipName)) {
      this.inflight.set(zipName, this.#fetchOverSsh(`eXo/eXoDOS/${zipName}`, cached).finally(() => this.inflight.delete(zipName)));
    }
    await this.inflight.get(zipName);
    this.#evict();
    return cached;
  }

  /** Local path of a game's extras zip (Content/GameData/eXoDOS/<name>.zip), or null if it has none. */
  async gameDataZip(zipName) {
    if (zipName.includes("/") || zipName.includes("\\") || zipName.startsWith(".")) throw new Error("bad zip name");
    if (this.root) {
      const p = join(this.root, "Content", "GameData", "eXoDOS", zipName);
      return existsSync(p) ? p : null;
    }
    const dir = join(this.cacheDir, "gamedata");
    mkdirSync(dir, { recursive: true });
    const cached = join(dir, zipName);
    if (existsSync(cached)) return cached;
    const key = `gamedata/${zipName}`;
    if (!this.inflight.has(key)) {
      this.inflight.set(key, this.#fetchOverSsh(`Content/GameData/eXoDOS/${zipName}`, cached).finally(() => this.inflight.delete(key)));
    }
    try {
      await this.inflight.get(key);
    } catch (e) {
      if (/No such file/i.test(String(e.message))) return null; // game has no extras
      throw e;
    }
    return cached;
  }

  #fetchOverSsh(rel, dest) {
    const [host, base] = this.ssh.split(/:(.*)/s);
    const args = ["-n", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10"];
    if (this.sshKey) args.push("-i", this.sshKey, "-o", "IdentitiesOnly=yes");
    // ssh reads known_hosts from the *process user's* home, which isn't the
    // key owner's when the dev server runs in a container.
    if (this.sshKnownHosts) args.push("-o", `UserKnownHostsFile=${this.sshKnownHosts}`);
    // Single-quote for the remote shell; eXo names contain spaces, commas, $ and '.
    const remote = `${base}/${rel}`.replace(/'/g, "'\\''");
    args.push(host, `cat '${remote}'`);
    const part = `${dest}.part`;
    return new Promise((resolve, reject) => {
      const out = createWriteStream(part);
      const p = spawn("ssh", args, { stdio: ["ignore", "pipe", "pipe"] });
      let err = "";
      p.stderr.on("data", (d) => { err += d; });
      p.stdout.pipe(out);
      p.on("close", (code) => {
        out.close(() => {
          if (code === 0 && statSync(part).size > 0) { renameSync(part, dest); resolve(); }
          else { try { unlinkSync(part); } catch {} reject(new Error(`fetch ${basename(rel)} failed: ${err.trim() || code}`)); }
        });
      });
    });
  }

  #evict() {
    const files = readdirSync(this.cacheDir).filter((f) => !f.endsWith(".part"))
      .map((f) => { const s = statSync(join(this.cacheDir, f)); return s.isFile() ? { f, size: s.size, t: s.mtimeMs } : null; })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t);
    let total = files.reduce((s, x) => s + x.size, 0);
    for (const x of files) {
      if (total <= this.cacheMax) break;
      unlinkSync(join(this.cacheDir, x.f));
      total -= x.size;
    }
  }
}

/** eXo names a game's zip after its launcher .bat (catalogue application_path). */
export function zipNameFor(game) {
  const bat = (game.application_path ?? "").replace(/\\/g, "/").split("/").pop();
  return bat ? bat.replace(/\.bat$/i, ".zip") : null;
}
