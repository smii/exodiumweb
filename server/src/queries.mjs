// Port of Exodium's src-tauri/src/db/queries.rs (v0.15.2): same SQL, so the
// Library page sorts, groups, filters and merges language variants exactly
// like the desktop app.
import { rowToGame } from "./db.mjs";

// Language packs resolve to their base collection (COLLECTION_MAP).
const FAMILY = { eXoDOS_GLP: "eXoDOS", eXoDOS_SLP: "eXoDOS", eXoDOS_PLP: "eXoDOS" };
export const baseCollection = (id) => FAMILY[id] ?? id;

const familyExpr = (a) =>
  `COALESCE(CASE ${a}.torrent_source${Object.entries(FAMILY).map(([k, v]) => ` WHEN '${k}' THEN '${v}'`).join("")} END, ${a}.torrent_source, 'eXoDOS')`;
const sameGroup = (a, b) => `${a}.shortcode = ${b}.shortcode AND ${familyExpr(a)} = ${familyExpr(b)}`;
const playableMusic = (a) =>
  `${a}.music_file IS NOT NULL AND ${a}.gamedata_torrent_index IS NOT NULL AND (lower(${a}.music_file) LIKE '%.mp3' OR lower(${a}.music_file) LIKE '%.ogg')`;

const primaryRow = () => `(g.shortcode IS NULL OR g.id = (
  SELECT p.id FROM games p WHERE ${sameGroup("p", "g")}
  ORDER BY CASE WHEN p.language = 'EN' THEN 0 ELSE 1 END, p.id LIMIT 1))`;

function whereClause(f) {
  const params = [];
  const variant = [];
  if (f.query) { params.push(`%${f.query}%`); variant.push("v.title LIKE ?"); }
  if (f.genre) { params.push(`%${f.genre}%`); variant.push("v.genre LIKE ?"); }
  if (f.collection) { params.push(f.collection); variant.push("v.torrent_source = ?"); }
  if (f.favoritesOnly) variant.push("v.favorited = 1");

  const conds = [primaryRow()];
  if (f.withMusic) {
    conds.push(`EXISTS (SELECT 1 FROM games w WHERE (w.id = g.id OR (g.shortcode IS NOT NULL AND ${sameGroup("w", "g")})) AND ${playableMusic("w")})`);
  }
  const playlistParams = [];
  if (f.playlistId != null) {
    playlistParams.push(f.playlistId);
    conds.push(`g.id IN (SELECT CASE WHEN m.shortcode IS NULL THEN m.id ELSE (
        SELECT p.id FROM games p WHERE ${sameGroup("p", "m")}
        ORDER BY CASE WHEN p.language = 'EN' THEN 0 ELSE 1 END, p.id LIMIT 1) END
      FROM playlist_games pg JOIN games m ON m.id = pg.game_id WHERE pg.playlist_id = ?)`);
  }
  if (variant.length) {
    conds.push(`EXISTS (SELECT 1 FROM games v WHERE (v.id = g.id OR (g.shortcode IS NOT NULL AND ${sameGroup("v", "g")})) AND ${variant.join(" AND ")})`);
  }
  // Placeholder order must follow the SQL text: playlist (in conds) before variant.
  return { sql: ` WHERE ${conds.join(" AND ")}`, params: [...playlistParams, ...params] };
}

const TITLE_ORDER = "COALESCE(sort_title, title) COLLATE NOCASE";
function orderClause(sortBy) {
  switch (sortBy) {
    case "year_asc": return `ORDER BY COALESCE(year, 9999) ASC, ${TITLE_ORDER} ASC`;
    case "year_desc": return `ORDER BY COALESCE(year, 0) DESC, ${TITLE_ORDER} ASC`;
    case "rating": return `ORDER BY CAST(ROUND(COALESCE(rating, -1)) AS INTEGER) DESC, COALESCE(rating_votes, 0) DESC, COALESCE(rating, -1) DESC, ${TITLE_ORDER} ASC`;
    case "title_desc": return `ORDER BY ${TITLE_ORDER} DESC`;
    case "genre": return `ORDER BY COALESCE(genre, 'zzz') ASC, ${TITLE_ORDER} ASC`;
    case "developer": return `ORDER BY (developer IS NULL OR developer = ''), developer COLLATE NOCASE ASC, ${TITLE_ORDER} ASC`;
    case "developer_desc": return `ORDER BY (developer IS NULL OR developer = ''), developer COLLATE NOCASE DESC, ${TITLE_ORDER} ASC`;
    case "publisher": return `ORDER BY (publisher IS NULL OR publisher = ''), publisher COLLATE NOCASE ASC, ${TITLE_ORDER} ASC`;
    case "publisher_desc": return `ORDER BY (publisher IS NULL OR publisher = ''), publisher COLLATE NOCASE DESC, ${TITLE_ORDER} ASC`;
    case "size": return `ORDER BY (download_size IS NULL), download_size ASC, ${TITLE_ORDER} ASC`;
    case "size_desc": return `ORDER BY (download_size IS NULL), download_size DESC, ${TITLE_ORDER} ASC`;
    default: return `ORDER BY ${TITLE_ORDER} ASC`;
  }
}

/** Fold the Tauri command's camelCase args into a filter. */
export function filterFrom(a = {}) {
  return {
    query: a.query ?? "", genre: a.genre ?? "", sortBy: a.sortBy ?? "", collection: a.collection ?? "",
    favoritesOnly: !!a.favoritesOnly, playlistId: a.playlistId ?? null, withMusic: !!a.withMusic,
  };
}

export function fetchGames(db, page, perPage, f) {
  const { sql, params } = whereClause(f);
  const offset = Math.max(0, (page || 1) - 1) * perPage;
  const rows = db.prepare(`SELECT * FROM games g${sql} ${orderClause(f.sortBy)} LIMIT ? OFFSET ?`).all(...params, perPage, offset);
  const games = rows.map(rowToGame);
  attachLanguageMaps(db, games);
  return games;
}

export function countGames(db, f) {
  const { sql, params } = whereClause(f);
  return db.prepare(`SELECT COUNT(*) AS n FROM games g${sql}`).get(...params).n;
}

export function attachLanguageMaps(db, games) {
  const codes = [...new Set(games.map((g) => g.shortcode).filter(Boolean))];
  if (!codes.length) return;
  const rows = db.prepare(
    `SELECT ${familyExpr("g")} AS fam, g.shortcode, g.language, g.installed, g.in_library, g.title FROM games g
     WHERE g.shortcode IN (${codes.map(() => "?").join(",")})
     ORDER BY CASE WHEN g.language = 'EN' THEN 0 ELSE 1 END, g.language`,
  ).all(...codes);
  const map = new Map();
  const titles = new Map();
  for (const r of rows) {
    const key = `${r.fam}\u0000${r.shortcode}`;
    const state = r.installed ? 2 : r.in_library ? 1 : 0;
    (map.get(key) ?? map.set(key, []).get(key)).push(`${r.language ?? "EN"}:${state}`);
    if (r.title) (titles.get(key) ?? titles.set(key, []).get(key)).push(r.title);
  }
  for (const g of games) {
    if (!g.shortcode) continue;
    const key = `${baseCollection(g.torrent_source ?? "eXoDOS")}\u0000${g.shortcode}`;
    const entries = map.get(key);
    if (entries && entries.length > 1) {
      g.available_languages = entries.join(",");
      const others = (titles.get(key) ?? []).filter((t) => t !== g.title);
      if (others.length) g.variant_titles = others.join("\u001f");
    }
  }
}

export function sectionKeys(db, f) {
  const { sql, params } = whereClause(f);
  const letter = "CASE WHEN UPPER(SUBSTR(COALESCE(sort_title,title),1,1)) GLOB '[A-Z]' THEN UPPER(SUBSTR(COALESCE(sort_title,title),1,1)) ELSE '#' END";
  const spec = {
    title: [letter, "key ASC"], title_desc: [letter, "key DESC"],
    year_asc: ["COALESCE(CAST(year AS TEXT),'Unknown')", "key ASC"],
    year_desc: ["COALESCE(CAST(year AS TEXT),'Unknown')", "key DESC"],
    genre: ["COALESCE(genre,'Unknown')", "key ASC"],
    rating: ["CAST(ROUND(COALESCE(rating,-1)) AS INTEGER)", "key DESC"],
  }[f.sortBy];
  if (!spec) return [];
  const raw = db.prepare(`SELECT DISTINCT ${spec[0]} AS key FROM games g ${sql} ORDER BY ${spec[1]}`).all(...params).map((r) => String(r.key));
  if (f.sortBy === "rating") {
    return raw.map((s) => {
      const n = Number(s);
      if (Number.isNaN(n) || n < 0) return "Unrated";
      const k = Math.min(5, Math.max(0, n));
      return "★".repeat(k) + "☆".repeat(5 - k);
    });
  }
  if (f.sortBy === "genre") {
    const seen = new Set();
    for (const e of raw) {
      const parent = (e.split(";")[0] ?? "").split(" / ")[0].trim();
      if (parent) seen.add(parent);
    }
    return [...seen].sort();
  }
  return raw;
}

export function genres(db, collection) {
  const rows = collection
    ? db.prepare("SELECT DISTINCT genre FROM games WHERE genre IS NOT NULL AND genre != '' AND torrent_source = ?").all(collection)
    : db.prepare("SELECT DISTINCT genre FROM games WHERE genre IS NOT NULL AND genre != ''").all();
  const set = new Set();
  for (const r of rows) for (const g of r.genre.split(";")) if (g.trim()) set.add(g.trim());
  return [...set].sort();
}

export function gameById(db, id) {
  return rowToGame(db.prepare("SELECT * FROM games WHERE id = ?").get(id) ?? null);
}

export function gameVariants(db, shortcode, collection) {
  return db.prepare(
    `SELECT * FROM games g WHERE g.shortcode = ? AND ${familyExpr("g")} = ?
     ORDER BY CASE g.language WHEN 'EN' THEN 0 ELSE 1 END, g.language`,
  ).all(shortcode, baseCollection(collection)).map(rowToGame);
}

export function toggleFavorite(db, id) {
  db.prepare("UPDATE games SET favorited = 1 - favorited WHERE id = ?").run(id);
  return !!db.prepare("SELECT favorited FROM games WHERE id = ?").get(id)?.favorited;
}

/** "My Library": games the user played or favourited, one row per group. */
export function libraryGames(db) {
  const games = db.prepare(
    `SELECT * FROM games g WHERE (g.last_played IS NOT NULL OR g.in_library = 1 OR g.favorited = 1) AND ${primaryRow()}
     ORDER BY COALESCE(sort_title, title) COLLATE NOCASE`,
  ).all().map(rowToGame);
  attachLanguageMaps(db, games);
  return games;
}

export function recentlyPlayed(db, limit = 12) {
  const games = db.prepare("SELECT * FROM games WHERE last_played IS NOT NULL ORDER BY last_played DESC LIMIT ?").all(limit).map(rowToGame);
  attachLanguageMaps(db, games);
  return games;
}

export function setLastPlayed(db, id) {
  db.prepare("UPDATE games SET last_played = datetime('now'), in_library = 1 WHERE id = ?").run(id);
}

export function getConfig(db, key) {
  return db.prepare("SELECT value FROM config WHERE key = ?").get(key)?.value ?? null;
}
export function setConfig(db, key, value) {
  db.prepare("INSERT INTO config(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));
}

export function gameConfig(db, id) {
  return Object.fromEntries(db.prepare("SELECT key, value FROM game_config WHERE game_id = ?").all(id).map((r) => [r.key, r.value]));
}
export function setGameConfig(db, id, key, value) {
  if (value == null || value === "") db.prepare("DELETE FROM game_config WHERE game_id = ? AND key = ?").run(id, key);
  else db.prepare("INSERT INTO game_config(game_id, key, value) VALUES (?, ?, ?) ON CONFLICT(game_id, key) DO UPDATE SET value = excluded.value").run(id, key, value);
}

// ── Playlists ────────────────────────────────────────────────────────────
export function playlists(db) {
  return db.prepare(
    `SELECT p.id, p.name, p.kind, p.description, (SELECT COUNT(*) FROM playlist_games pg WHERE pg.playlist_id = p.id) AS game_count
     FROM playlists p ORDER BY CASE p.kind WHEN 'curated' THEN 0 ELSE 1 END, p.name COLLATE NOCASE`,
  ).all();
}
export function createPlaylist(db, name) {
  const clean = String(name ?? "").trim();
  if (!clean) throw "Playlist name can't be empty";
  if (db.prepare("SELECT 1 FROM playlists WHERE name = ? COLLATE NOCASE").get(clean)) throw `A playlist named "${clean}" already exists`;
  return Number(db.prepare("INSERT INTO playlists(name, kind) VALUES (?, 'user')").run(clean).lastInsertRowid);
}
export function renamePlaylist(db, id, name) {
  db.prepare("UPDATE playlists SET name = ? WHERE id = ? AND kind = 'user'").run(String(name).trim(), id);
}
export function deletePlaylist(db, id) {
  db.prepare("DELETE FROM playlist_games WHERE playlist_id = ?").run(id);
  db.prepare("DELETE FROM playlists WHERE id = ? AND kind = 'user'").run(id);
}
export function setPlaylistMembership(db, playlistId, gameId, member) {
  if (member) {
    const pos = db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM playlist_games WHERE playlist_id = ?").get(playlistId).p;
    db.prepare("INSERT OR IGNORE INTO playlist_games(playlist_id, game_id, position) VALUES (?, ?, ?)").run(playlistId, gameId, pos);
  } else {
    db.prepare("DELETE FROM playlist_games WHERE playlist_id = ? AND game_id = ?").run(playlistId, gameId);
  }
}
export function gamePlaylistIds(db, gameId) {
  return db.prepare("SELECT playlist_id FROM playlist_games WHERE game_id = ?").all(gameId).map((r) => r.playlist_id);
}
