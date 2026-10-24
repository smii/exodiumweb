// Multi-disc launchers: one campaign per CD, picked before downloading.
//
// eXo's multi-CD games (Command & Conquer, Red Alert, ...) open a DOS menu
// whose choices each `imgmount` a different disc first, plus the rest for
// CTRL-F4 swapping:
//
//   echo Press 1 for Command & Conquer GDI Campaign
//   choice /C:123456 /N Please Choose:
//   if errorlevel = 1 goto GDI
//   :GDI
//   imgmount d ".\eXoDOS\comcon\cd\CD-1.iso" ".\eXoDOS\comcon\cd\CD-2.iso" ... -t cdrom
//
// The whole set is 1.3 GB (C&C) to 2.2 GB (Red Alert): a browser holds the
// bundle several times over while unpacking it, which runs out of memory
// long before the game starts. A campaign only plays from its own disc, so
// the player offers the menu's choices first and the bundle for a choice
// carries just that disc: the launcher jumps straight to the choice's label
// and mounts only the disc that is there.
import { hostPath } from "./translate.mjs";

const IMAGE = /\.(iso|cue|bin|img|ccd|sub|mdf|mds|gog|ins)$/i;

/** Bundle-relative entry name for a mount argument (`.\eXoDOS\x\cd\a.iso` -> `x/cd/a.iso`). */
function entryOf(arg) {
  return hostPath(arg).replace(/^"|"$/g, "").replace(/^\.\//, "");
}

/** Image files a .cue needs besides itself (its FILE lines), as entry names. */
function cueFiles(src, name) {
  const dir = name.slice(0, name.lastIndexOf("/") + 1);
  const text = src.read(name)?.toString("latin1") ?? "";
  return [...text.matchAll(/^\s*FILE\s+"([^"]+)"|^\s*FILE\s+(\S+)/gim)].map((m) => dir + (m[1] ?? m[2]));
}

/** Zip entry for a name, matched case-insensitively (DOS paths), or null. */
function lookup(src, name) {
  if (src.entries.has(name)) return name;
  const low = name.toLowerCase();
  for (const n of src.entries.keys()) if (n.toLowerCase() === low) return n;
  return null;
}

/** A disc and everything it reads from (cue -> bin), as zip entry names. */
function discEntries(src, name) {
  const e = lookup(src, name);
  if (!e) return [];
  if (!/\.cue$/i.test(e)) return [e];
  return [e, ...cueFiles(src, e).map((f) => lookup(src, f)).filter(Boolean)];
}

/**
 * The disc menu in one launcher batch, or null when it isn't one:
 * [{ key, label, target, disc }] where disc is the first image the choice mounts.
 */
export function parseDiscMenu(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const choice = lines.map((l) => l.match(/^\s*@?choice\b.*\/c:?([a-z0-9]+)/i)).find(Boolean);
  if (!choice) return null;
  const keys = choice[1].toUpperCase();
  const labels = new Map();
  for (const l of lines) {
    const m = l.match(/^\s*@?echo\s+press\s+(\S)\s+(?:for|to)\s+(.+?)\s*$/i);
    if (m) labels.set(m[1].toUpperCase(), m[2]);
  }
  const blocks = new Map();
  let cur = null;
  for (const l of lines) {
    const lab = l.match(/^\s*:(\S+)/);
    if (lab) { cur = lab[1].toLowerCase(); blocks.set(cur, []); continue; }
    if (cur) blocks.get(cur).push(l);
  }
  const options = [];
  for (const l of lines) {
    const m = l.match(/^\s*@?if\s+errorlevel\s*=?\s*(\d+)\s+goto\s+(\S+)/i);
    if (!m) continue;
    const key = keys[Number(m[1]) - 1];
    const target = m[2].toLowerCase();
    // The block's first imgmount line, and its first image argument.
    const mount = (blocks.get(target) ?? []).find((b) => /^\s*@?imgmount\s+\S+\s+/i.test(b));
    const args = mount?.replace(/^\s*@?imgmount\s+\S+\s+/i, "").match(/"[^"]*"|\S+/g) ?? [];
    const first = args.find((a) => IMAGE.test(a.replace(/"/g, "")));
    if (!key || !first || options.some((o) => o.key === key)) continue;
    options.push({ key, label: labels.get(key) ?? `Option ${key}`, target, disc: entryOf(first) });
  }
  options.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
  return options.length ? options : null;
}

/**
 * Disc choices for a game zip, or null when a single bundle is fine:
 * { bat, options: [{ key, label, bytes }] }. Offered when the menu's
 * choices start from at least two different discs and the discs are large.
 */
export function discChoices(src, minBytes) {
  for (const [bat, e] of src.entries) {
    if (!/(^|\/)run\.bat$/i.test(bat) || e.usize > 256 * 1024) continue;
    const options = parseDiscMenu(src.read(bat).toString("latin1"));
    if (!options) continue;
    const discs = new Set(options.map((o) => discEntries(src, o.disc)[0]).filter(Boolean));
    if (discs.size < 2) continue;
    const allDiscs = new Set(options.flatMap((o) => discEntries(src, o.disc)));
    const discBytes = [...allDiscs].reduce((n, d) => n + src.entries.get(d).usize, 0);
    if (discBytes < minBytes) continue;
    const rest = [...src.entries.values()].reduce((n, x) => n + x.csize, 0) - [...allDiscs].reduce((n, d) => n + src.entries.get(d).csize, 0);
    return {
      bat,
      options: options.filter((o) => discEntries(src, o.disc).length).map((o) => ({
        key: o.key, label: o.label,
        bytes: rest + discEntries(src, o.disc).reduce((n, d) => n + src.entries.get(d).csize, 0),
      })),
    };
  }
  return null;
}

/**
 * Bundle plan for one choice: entries to leave out (every other disc the
 * menu mounts) and the launcher rewritten to go straight to the choice and
 * mount only its own disc.
 */
export function discPlan(src, bat, key) {
  const text = src.read(bat).toString("latin1");
  const options = parseDiscMenu(text) ?? [];
  const pick = options.find((o) => o.key === String(key).toUpperCase());
  if (!pick) return null;
  const keep = new Set(discEntries(src, pick.disc));
  const omit = new Set();
  // Every image mounted anywhere in the launcher that isn't the chosen disc.
  for (const m of text.matchAll(/^\s*@?imgmount\s+\S+\s+(.*)$/gim)) {
    for (const a of m[1].match(/"[^"]*"|\S+/g) ?? []) {
      if (!IMAGE.test(a.replace(/"/g, ""))) continue;
      for (const d of discEntries(src, entryOf(a))) if (!keep.has(d)) omit.add(d);
    }
  }
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  let inTarget = false;
  const out = text.split(/\r?\n/).map((l) => {
    const lab = l.match(/^\s*:(\S+)/);
    if (lab) inTarget = lab[1].toLowerCase() === pick.target;
    if (/^\s*@?choice\b/i.test(l)) return `goto ${pick.target}`;
    const im = inTarget && l.match(/^(\s*@?imgmount\s+\S+\s+)(.*?)(\s+-t\s+\S+.*)?$/i);
    if (!im) return l;
    const args = (im[2].match(/"[^"]*"|\S+/g) ?? []).filter((a) => !IMAGE.test(a.replace(/"/g, "")) || discEntries(src, entryOf(a)).every((d) => keep.has(d)));
    return `${im[1]}${args.join(" ")}${im[3] ?? ""}`;
  });
  return { omit, bat, text: out.join(eol), label: pick.label };
}
