// Catalogue + per-user databases.
//
// The catalogue is Exodium's bundled exodium.db, trimmed to the collections
// this server can play. Every user gets their own copy of it (~20 MB), so
// favourites, playlists, "recently played" and per-game settings live in the
// same tables Exodium's queries expect: the query code ports over unchanged.
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export const ENABLED_COLLECTIONS = ["eXoDOS"];

const BOOL_COLUMNS = ["in_library", "installed", "favorited", "has_thumbnail"];

/** Build data/catalog.db from data/exodium.db when missing or older. */
export function ensureCatalog(dataDir) {
  const src = join(dataDir, "exodium.db");
  const out = join(dataDir, "catalog.db");
  if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) return out;
  const tmp = `${out}.tmp`;
  copyFileSync(src, tmp);
  const db = new DatabaseSync(tmp);
  const keep = ENABLED_COLLECTIONS.map((c) => `'${c}'`).join(",");
  db.exec(`
    DELETE FROM playlist_games WHERE game_id IN (SELECT id FROM games WHERE torrent_source NOT IN (${keep}));
    DELETE FROM game_articles WHERE shortcode NOT IN (SELECT shortcode FROM games WHERE torrent_source IN (${keep}));
    DELETE FROM games WHERE torrent_source NOT IN (${keep});
    -- Every game streams from the collection, so all are "installed": the UI
    -- shows Play instead of Download. "My Library" is played/added games.
    UPDATE games SET installed = 1, in_library = 0, favorited = 0, last_played = NULL;
    DELETE FROM config;
    DELETE FROM game_config;
  `);
  db.exec("VACUUM");
  db.close();
  renameSync(tmp, out);
  return out;
}

const userDbs = new Map();

/** Open (creating on first use) a user's own database. */
export function userDb(stateDir, catalogPath, user) {
  const safe = user.replace(/[^a-zA-Z0-9_.-]/g, "_") || "anonymous";
  const cached = userDbs.get(safe);
  if (cached) return cached;
  const path = join(stateDir, "users", `${safe}.db`);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(catalogPath, path);
    const fresh = new DatabaseSync(path);
    const set = fresh.prepare("INSERT OR REPLACE INTO config(key, value) VALUES (?, ?)");
    // Desktop onboarding (welcome modal, seeding consent) means nothing here.
    for (const [k, v] of [["welcome_seen", "1"], ["seeding_consent", "declined"], ["seeding_enabled", "0"]]) set.run(k, v);
    fresh.close();
  }
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  userDbs.set(safe, db);
  return db;
}

export function rowToGame(row) {
  if (!row) return row;
  const g = { ...row };
  for (const c of BOOL_COLUMNS) if (c in g) g[c] = !!g[c];
  g.available_languages ??= null;
  g.variant_titles ??= null;
  g.language ??= "EN";
  return g;
}
