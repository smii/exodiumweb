// Reading Room: the magazines, books and catalogs from eXo's Media Pack
// (and the German GLP add-on), indexed in Exodium's bundled catalogue.
//
// The catalogue (publications, issues, covers) is always browsable. Opening
// an issue needs its archive in the collection (`issues.zip_file`, e.g.
// Content/DOSMagazines.zip); the document is copied out of it into the cache
// once and served from there. Without the pack, open_issue answers with an
// error the UI turns into "belongs to a collection this install does not have".
// Per-user state (favourite, last page) lives in the user's own database.
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { createHash } from "node:crypto";

const ISSUE_COLUMNS = `
  i.*, p.name AS publication,
  COALESCE(s.favorited, 0) AS favorited, COALESCE(s.installed, 0) AS installed,
  s.last_page, s.last_opened`;

function rowToIssue(r) {
  if (!r) return null;
  return { ...r, runnable: !!r.runnable, favorited: !!r.favorited, installed: !!r.installed };
}

export function listPublications(db, kind) {
  return db.prepare(`SELECT * FROM publications ${kind ? "WHERE kind = ?" : ""} ORDER BY name COLLATE NOCASE`)
    .all(...(kind ? [kind] : []));
}

export function listIssues(db, { kind, publicationId, query }) {
  const where = [];
  const args = [];
  if (kind) { where.push("i.kind = ?"); args.push(kind); }
  if (publicationId != null) { where.push("i.publication_id = ?"); args.push(publicationId); }
  if (query) { where.push("(i.title LIKE ? OR p.name LIKE ?)"); args.push(`%${query}%`, `%${query}%`); }
  return db.prepare(`
    SELECT ${ISSUE_COLUMNS}
    FROM issues i JOIN publications p ON p.id = i.publication_id
    LEFT JOIN issue_state s ON s.issue_key = i.key
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY p.name COLLATE NOCASE, COALESCE(i.release_date, i.year), COALESCE(i.sort_title, i.title) COLLATE NOCASE`)
    .all(...args).map(rowToIssue);
}

export function getIssue(db, key) {
  return rowToIssue(db.prepare(`
    SELECT ${ISSUE_COLUMNS}
    FROM issues i JOIN publications p ON p.id = i.publication_id
    LEFT JOIN issue_state s ON s.issue_key = i.key
    WHERE i.key = ?`).get(key));
}

/** "This game was covered in": eXo's per-game index of magazine pages. */
export function gameArticles(db, gameId) {
  return db.prepare(`
    SELECT a.kind, a.page, i.key AS issue_key, i.title AS issue_title, p.name AS publication, i.year, i.language
    FROM games g
    JOIN game_articles a ON a.shortcode = g.shortcode
    JOIN issues i ON i.entry_path = a.entry_path
    JOIN publications p ON p.id = i.publication_id
    WHERE g.id = ?
    ORDER BY i.year, p.name, a.page`).all(gameId);
}

function upsertState(db, key, column, value) {
  db.prepare(`INSERT INTO issue_state (issue_key, ${column}, last_opened) VALUES (?, ?, datetime('now'))
    ON CONFLICT(issue_key) DO UPDATE SET ${column} = excluded.${column}, last_opened = excluded.last_opened`)
    .run(key, value);
}

export const setIssueFavorited = (db, key, favorited) => upsertState(db, key, "favorited", favorited ? 1 : 0);
export const setIssuePage = (db, key, page) => upsertState(db, key, "last_page", page);

/** Extracted documents, shared by all users: <cache>/reading/<key><ext>. */
export class ReadingCache {
  constructor(cacheDir, collection) {
    this.dir = join(cacheDir, "reading");
    mkdirSync(this.dir, { recursive: true });
    this.collection = collection;
    this.status = new Map(); // key -> last ReadingStatus
  }

  /** Keys look like "mag:eXo/Magazines/…/X.pdf", so files are named by a hash. */
  #file(issue) {
    const ext = extname(issue.entry_path ?? "").toLowerCase() || ".pdf";
    return join(this.dir, `${createHash("sha1").update(issue.key).digest("hex").slice(0, 20)}${ext}`);
  }

  /** Path for /asset?path=reading:<file>, or null. */
  resolve(name) {
    const p = join(this.dir, name);
    return name.includes("/") || name.includes("..") || !existsSync(p) ? null : p;
  }

  /** Keys of issues whose document is already extracted. */
  index(db) {
    if (readdirSync(this.dir).length === 0) return [];
    return db.prepare("SELECT key, entry_path FROM issues WHERE entry_path IS NOT NULL").all()
      .filter((i) => existsSync(this.#file(i))).map((i) => i.key);
  }

  open(issue) {
    const done = (s) => { this.status.set(issue.key, s); return s; };
    if (issue.runnable || !issue.entry_path) {
      return done({ phase: "error", progress: 0, total_bytes: issue.size_bytes, path: null,
        error: "This is a disk magazine (a DOS program); the browser version has not enabled running those yet." });
    }
    const file = this.#file(issue);
    const ready = () => done({ phase: "ready", progress: 1, total_bytes: statSync(file).size, path: `reading:${file.slice(this.dir.length + 1)}`, error: null });
    if (existsSync(file)) return ready();
    const pack = this.collection.contentPack(issue.zip_file);
    if (!pack) {
      return done({ phase: "error", progress: 0, total_bytes: issue.size_bytes, path: null,
        error: `The ${issue.source} pack (${issue.zip_file}) is not in this collection: this install has not enabled it.` });
    }
    const zip = issue.inner_zip ? pack.nested(issue.inner_zip) : pack;
    try {
      const data = zip?.read(issue.entry_path);
      if (!data) {
        return done({ phase: "error", progress: 0, total_bytes: issue.size_bytes, path: null,
          error: `${issue.entry_path} is not in ${issue.inner_zip ?? issue.zip_file}` });
      }
      writeFileSync(`${file}.tmp`, data);
      renameSync(`${file}.tmp`, file);
    } finally {
      if (zip && zip !== pack) zip.close();
    }
    return ready();
  }

  get(key) {
    return this.status.get(key) ?? null;
  }

  remove(issue) {
    rmSync(this.#file(issue), { force: true });
    this.status.delete(issue.key);
  }
}
