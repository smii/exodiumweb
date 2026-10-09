// Tauri command table: name -> (ctx, args) => result. ctx = { db, user, app }.
// Commands for desktop-only features (torrents, seeding, storage, updater,
// setup wizard) answer with harmless "nothing to do" values.
import * as q from "./queries.mjs";
import * as r from "./reading.mjs";
import { ENABLED_COLLECTIONS } from "./db.mjs";
import { imagesFor, GameData } from "./media.mjs";
import { zipNameFor } from "./collection.mjs";

const COLLECTION_NAMES = { eXoDOS: "eXoDOS", eXoWin3x: "eXoWin3x", eXoWin9x: "eXoWin9x", eXoScummVM: "eXoScummVM" };

const noop = () => null;
const emptyList = () => [];

export const commands = {
  // ── Setup / app state ──────────────────────────────────────────────────
  get_setup_status: () => ({ phase: "ready", metadata_progress: null, dosbox_metadata_progress: null, games_imported: 0, ready: true }),
  get_config: ({ db }, { key }) => {
    // Keep desktop-only flows (layout migration, offline mode prompts) inert.
    if (key === "data_dir") return "/collection";
    if (key === "root_folder") return "eXoDOS";
    return q.getConfig(db, key);
  },
  set_config: ({ db }, { key, value }) => { q.setConfig(db, key, value); return null; },
  init_download_manager: () => true,
  scan_installed_games: () => 0,
  pending_layout_migration: noop,
  skip_layout_migration: noop,
  get_available_collections: ({ db }) =>
    ENABLED_COLLECTIONS.map((id) => ({
      id,
      display_name: COLLECTION_NAMES[id] ?? id,
      torrent_file: `${id}.torrent`,
      game_count: db.prepare("SELECT COUNT(*) AS n FROM games WHERE torrent_source = ?").get(id).n,
    })),
  get_preview_dir: ({ app }, { collection }) => `${app.previewRoot}/${collection === "eXoMedia" ? "eXoMedia" : collection ?? "eXoDOS"}`,
  get_poster_dir: () => null,
  get_log_dir: () => "/server/logs",
  get_default_data_dir: () => "/collection",

  // ── Library ────────────────────────────────────────────────────────────
  get_games: ({ db }, a) => {
    const f = q.filterFrom(a);
    const perPage = Math.min(Number(a.perPage) || 60, 500);
    return { games: q.fetchGames(db, Number(a.page) || 1, perPage, f), total: q.countGames(db, f) };
  },
  get_section_keys: ({ db }, a) => q.sectionKeys(db, q.filterFrom({ ...a, sortBy: a.sortBy })),
  get_genres: ({ db }, { collection }) => q.genres(db, collection ?? ""),
  get_game: ({ db }, { id }) => q.gameById(db, id),
  get_game_variants: ({ db }, { shortcode, collection }) => q.gameVariants(db, shortcode, collection),
  toggle_favorite: ({ db }, { id }) => q.toggleFavorite(db, id),
  get_installed_games: ({ db }) => q.libraryGames(db),
  get_recently_played: ({ db }, { limit }) => q.recentlyPlayed(db, limit ?? 12),

  // ── Playlists ──────────────────────────────────────────────────────────
  get_playlists: ({ db }) => q.playlists(db),
  create_playlist: ({ db }, { name }) => q.createPlaylist(db, name),
  rename_playlist: ({ db }, { id, name }) => { q.renamePlaylist(db, id, name); return null; },
  delete_playlist: ({ db }, { id }) => { q.deletePlaylist(db, id); return null; },
  set_playlist_membership: ({ db }, { playlistId, gameId, member }) => { q.setPlaylistMembership(db, playlistId, gameId, member); return null; },
  get_game_playlists: ({ db }, { gameId }) => q.gamePlaylistIds(db, gameId),

  // ── Per-game settings ──────────────────────────────────────────────────
  get_game_settings: ({ db }, { id }) => {
    const c = q.gameConfig(db, id);
    return { engine: c.engine ?? null, glshader: c.glshader ?? null, fullscreen: c.fullscreen ?? null, cycles: c.cycles ?? null, custom_conf: c.custom_conf ?? null };
  },
  set_game_settings: ({ db }, { id, engine, glshader, fullscreen, cycles, customConf }) => {
    for (const [k, v] of Object.entries({ engine, glshader, fullscreen, cycles, custom_conf: customConf })) q.setGameConfig(db, id, k, v ?? null);
    return null;
  },
  game_engine_info: () => ({ ece_available: false, uses_ece: false }),
  game_printing_unavailable: () => false,

  // ── Play: the browser player opens client-side (web-shims/core.ts) ──────
  launch_game: ({ db }, { id }) => {
    const g = q.gameById(db, id);
    if (!g) throw `Game ${id} not found`;
    q.setLastPlayed(db, id);
    return `player:${id}`;
  },
  // "Uninstall" in a streaming library = remove from My Library.
  uninstall_game: ({ db }, { id }) => {
    db.prepare("UPDATE games SET in_library = 0, last_played = NULL WHERE id = ?").run(id);
    return "removed";
  },

  // ── Desktop-only: downloads, seeding, storage, updates ──────────────────
  download_game: ({ db }, { id }) => { db.prepare("UPDATE games SET in_library = 1 WHERE id = ?").run(id); return "installed"; },
  get_download_progress: noop,
  list_active_downloads: emptyList,
  cancel_download: emptyList,
  get_transfer_stats: () => ({ download_bps: 0, upload_bps: 0, uploaded_bytes: 0, peers: 0, active: false }),
  set_seeding_enabled: noop,
  set_rate_limits: noop,
  storage_overview: () => ({ folder: "/collection", free_bytes: 0, total_bytes: 0, used_bytes: 0, other_bytes: 0, categories: [] }),
  installed_games_storage: emptyList,
  archive_usage: () => ({ bytes: 0, count: 0 }),
  remove_installed_archives: () => ({ bytes: 0, count: 0 }),
  clear_media_caches: () => ({ bytes: 0, items: 0 }),
  delete_save_backups: () => ({ bytes: 0, items: 0 }),
  game_disk_usage: () => ({ game_bytes: 0, archive_bytes: 0, save_bytes: 0 }),
  reset_game_data: () => ({ removed: 0 }),
  factory_reset: noop,
  open_document: noop,
  get_torrent_info: () => ({ name: "eXoDOS", file_count: 0, total_size: 0, metadata_size: 0 }),

  // ── Not playable in the browser yet ─────────────────────────────────────
  win9x_engine_available: () => false,
  get_win9x_support_status: () => ({ installed: false, installing: false, progress: null, error: null }),
  get_scummvm_support_status: () => ({ installed: false, installing: false, progress: null, error: null }),
  win9x_network_status: () => ({ enabled: false, supported: false }),
  scummvm_engine_info: noop,
  scummvm_variants: noop,

  // ── Media: gallery, manual, video preview, theme music ──────────────────
  get_game_metadata: ({ db, app }, { title, shortcode, manualPath }) => {
    const images = imagesFor(app.imageIndex, title);
    let manual_path = null;
    let manual_kind = null;
    const game = shortcode ? db.prepare("SELECT id FROM games WHERE shortcode = ? ORDER BY CASE language WHEN 'EN' THEN 0 ELSE 1 END LIMIT 1").get(shortcode) : null;
    if (manualPath && game) {
      manual_path = `gamedata:${game.id}/${manualPath.replace(/\\/g, "/")}`;
      const ext = manualPath.split(".").pop().toLowerCase();
      manual_kind = ext === "pdf" ? "pdf" : ext === "txt" ? "txt" : ext.startsWith("htm") ? "html" : null;
    }
    return { manual_path, manual_kind, images, thumbnails: images };
  },
  game_articles: ({ db }, { id }) => r.gameArticles(db, id),

  // Reading Room (reading.mjs): catalogue always, documents when the pack is there.
  list_publications: ({ db }, { kind }) => r.listPublications(db, kind),
  list_issues: ({ db }, { kind, publicationId, query }) => r.listIssues(db, { kind, publicationId, query }),
  get_issue: ({ db }, { key }) => r.getIssue(db, key),
  set_issue_favorited: ({ db }, { key, favorited }) => { r.setIssueFavorited(db, key, favorited); return null; },
  set_issue_page: ({ db }, { key, page }) => { r.setIssuePage(db, key, page); return null; },
  open_issue: ({ db, app }, { key }) => {
    const issue = r.getIssue(db, key);
    if (!issue) throw `unknown issue ${key}`;
    return app.reading.open(issue);
  },
  get_issue_status: ({ app }, { key }) => app.reading.get(key),
  reading_cache_index: ({ db, app }) => app.reading.index(db),
  remove_issue: ({ db, app }, { key }) => { const i = r.getIssue(db, key); if (i) app.reading.remove(i); return null; },
  cancel_issue_fetch: noop,
  install_issue: () => { throw "Disk magazines (DOS programs) are not supported in the browser version yet."; },
  launch_issue: () => { throw "Disk magazines (DOS programs) are not supported in the browser version yet."; },
  list_content_packs: emptyList,
  video_playback_supported: () => true,
  video_mirror_needed: () => false,
  media_url: noop,
  start_game_video: (ctx, { id }) => mediaStatus(ctx, id, "Videos/MS-DOS/", [".mp4", ".webm"], true),
  get_video_status: (ctx, { id }) => mediaStatus(ctx, id, "Videos/MS-DOS/", [".mp4", ".webm"], false),
  cancel_game_video: noop,
  music_playback_supported: () => ({ mp3: true, ogg: true }),
  music_cache_index: () => ({ cached: [], none: [] }),
  start_game_music: (ctx, { id }) => mediaStatus(ctx, id, "Music/MS-DOS/", [".ogg", ".mp3"], true),
  get_music_status: (ctx, { id }) => mediaStatus(ctx, id, "Music/MS-DOS/", [".ogg", ".mp3"], false),
  cancel_game_music: noop,
  music_shuffle_candidates: ({ db }, { count }) =>
    db.prepare(`SELECT id, title, torrent_source, thumbnail_key, music_file FROM games
      WHERE music_file IS NOT NULL AND gamedata_torrent_index IS NOT NULL AND (lower(music_file) LIKE '%.ogg' OR lower(music_file) LIKE '%.mp3')
      ORDER BY random() LIMIT ?`).all(Math.min(Number(count) || 20, 100)),
};

/**
 * Video/music status for a game (Exodium's VideoStatus shape). `start` kicks
 * off fetching the game's GameData zip; the UI polls the get_* variant.
 */
function mediaStatus({ db, app }, id, dir, exts, start) {
  const game = q.gameById(db, id);
  const zip = game && zipNameFor(game);
  const none = { phase: "none", progress: 0, total_bytes: 0, path: null, error: null };
  if (!zip || game.gamedata_torrent_index == null) return none;
  if (start) app.gameData.load(zip);
  const s = app.gameData.status(zip);
  if (!s) return start ? { ...none, phase: "fetching" } : null;
  if (s.phase === "fetching") return { phase: "fetching", progress: 0, total_bytes: 0, path: null, error: null };
  if (s.phase === "error") return { phase: "error", progress: 0, total_bytes: 0, path: null, error: s.error };
  const entry = GameData.find(s.reader, dir, exts);
  if (!entry) return none;
  return { phase: "ready", progress: 1, total_bytes: s.reader.entries.get(entry).usize, path: `gamedata:${id}/${entry}`, error: null };
}

/** Unknown commands are logged once and answered with null. */
const warned = new Set();
export function runCommand(name, ctx, args) {
  const fn = commands[name];
  if (!fn) {
    if (!warned.has(name)) { warned.add(name); console.warn(`[invoke] unimplemented command: ${name} ${JSON.stringify(args).slice(0, 200)}`); }
    return null;
  }
  return fn(ctx, args ?? {});
}
