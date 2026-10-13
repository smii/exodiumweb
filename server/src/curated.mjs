// Fills gaps in eXo's curated playlists from the collection's own configs.
//
// eXo's "3dfx Games" playlist (29 titles) misses games eXo itself set up with
// a Voodoo card: their dosbox.conf turns 3dfx on (see analyse() in
// translate.mjs), they boot on DOSBox-X with Voodoo emulation here, but the
// LaunchBox playlist was never updated (Descent: eXoHOG, System Shock, Quake II
// (Q2DOS), ...). Every user database gets those added on open.
import { analyse } from "./translate.mjs";

const THREEDFX_SLUG = "exodos-3dfx-games";

/** Shortcodes whose collection config enables a real 3dfx card. */
export function voodooShortcodes(metadataZip) {
  const out = new Set();
  if (!metadataZip) return out;
  for (const name of metadataZip.entries.keys()) {
    const m = name.match(/^eXo\/eXoDOS\/!dos\/([^/]+)\/dosbox\.conf$/i);
    if (m && analyse(metadataZip.read(name).toString("latin1")).voodoo) out.add(m[1].toLowerCase());
  }
  return out;
}

/** Add the missing 3dfx games to the curated playlist; returns how many were added. */
export function syncThreedfx(db, shortcodes) {
  const pl = db.prepare("SELECT id FROM playlists WHERE slug = ?").get(THREEDFX_SLUG);
  if (!pl || shortcodes.size === 0) return 0;
  const have = new Set(db.prepare("SELECT game_id FROM playlist_games WHERE playlist_id = ?").all(pl.id).map((r) => r.game_id));
  const add = db.prepare("SELECT id, shortcode FROM games").all()
    .filter((g) => g.shortcode && shortcodes.has(g.shortcode.toLowerCase()) && !have.has(g.id));
  let pos = db.prepare("SELECT COALESCE(MAX(position), 0) AS p FROM playlist_games WHERE playlist_id = ?").get(pl.id).p;
  const ins = db.prepare("INSERT OR IGNORE INTO playlist_games(playlist_id, game_id, position) VALUES (?, ?, ?)");
  for (const g of add) ins.run(pl.id, g.id, ++pos);
  return add.length;
}
