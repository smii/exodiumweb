#!/usr/bin/env node
// Build the compatibility overview from the game pages. Each page in
// docs/compatibility/games/<shortcode>.md starts with front matter (the only
// place a game's status is written down):
//
//   ---
//   title: "Command & Conquer"     required
//   year: 1995                     required
//   id: 8170                       required, the catalogue id
//   status: Playable               required: Playable | Boots | Partial | Not supported
//   backend: dosbox                required: dosbox | dosboxX
//   tested: 2026-10-23             required, last test date
//   group: Westwood Studios        optional, a test batch or series
//   note: "one-line fix or defect" optional
//   verified: "what was seen"      optional
//   commits: "e3fc2bf, 285eae4"    optional
//   ---
//
// Writes (never edit these by hand):
//   docs/compatibility/README.md  <!-- generated:stats -->  counts, status bar, groups, recent tests
//   docs/compatibility/GAMES.md   every tested game A–Z (split into list/<letter>.md above SPLIT_AT games)
//   docs/compatibility/games.csv  the same as a table GitHub can search and sort
//   README.md                     <!-- generated:tested --> one-paragraph summary
//
//   node tools/compat-index.mjs [--total N]   (N = games in the collection, default 7666)
// Idempotent; prints the counts. Fails on a page with missing or invalid fields.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "docs/compatibility");
const COMPAT = join(DIR, "README.md");
const README = join(ROOT, "README.md");
const ti = process.argv.indexOf("--total");
const TOTAL = ti > 0 ? Number(process.argv[ti + 1]) : 7666; // eXoDOS 6.04 catalogue
const SPLIT_AT = 300; // above this many games, GAMES.md becomes a letter index
const RECENT = 10;
const BAR_CELLS = 20;

const STATUSES = [
  { name: "Playable", icon: "🟢", cell: "🟩" },
  { name: "Boots", icon: "🟡", cell: "🟨" },
  { name: "Partial", icon: "🟠", cell: "🟧" },
  { name: "Not supported", icon: "🔴", cell: "🟥" },
];
const BACKENDS = ["dosbox", "dosboxX"];
const REQUIRED = ["title", "year", "id", "status", "backend", "tested"];
const meta = (s) => STATUSES.find((x) => x.name === s);

// --- read the pages -------------------------------------------------------
function frontMatter(text, file) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`${file}: no front matter (see tools/compat-index.mjs)`);
  const out = {};
  for (const line of m[1].split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const kv = line.match(/^([a-z]+):\s*(.*)$/);
    if (!kv) throw new Error(`${file}: bad front matter line: ${line}`);
    out[kv[1]] = kv[2].startsWith('"') ? JSON.parse(kv[2]) : kv[2];
  }
  return out;
}

const games = [];
for (const name of readdirSync(join(DIR, "games")).filter((f) => f.endsWith(".md")).sort()) {
  const file = `docs/compatibility/games/${name}`;
  const g = frontMatter(readFileSync(join(DIR, "games", name), "utf8"), file);
  for (const k of REQUIRED) if (!g[k]) throw new Error(`${file}: missing ${k}`);
  if (!meta(g.status)) throw new Error(`${file}: status must be one of ${STATUSES.map((s) => s.name).join(", ")}`);
  if (!BACKENDS.includes(g.backend)) throw new Error(`${file}: backend must be ${BACKENDS.join(" or ")}`);
  if (!/^\d{4}-\d\d-\d\d$/.test(g.tested)) throw new Error(`${file}: tested must be YYYY-MM-DD`);
  games.push({ ...g, code: name.slice(0, -3) });
}
if (!games.length) throw new Error("no game pages in docs/compatibility/games");
const ids = new Map();
for (const g of games) {
  if (ids.has(g.id)) throw new Error(`id ${g.id} on both ${ids.get(g.id)} and ${g.code}`);
  ids.set(g.id, g.code);
}

// --- helpers --------------------------------------------------------------
const tested = games.length;
const count = (s, list = games) => list.filter((g) => g.status === s).length;
const pct = (n, d) => (100 * n / d).toLocaleString("en", { maximumFractionDigits: 1 });
const n = (x) => x.toLocaleString("en");
const cell = (s) => (s ?? "").replace(/\|/g, "\\|");
const byTitle = [...games].sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
const letterOf = (g) => (/^[A-Za-z]/.test(g.title) ? g.title[0].toUpperCase() : "#");
const link = (g, base) => `[${cell(g.title)}](${base}${g.code}.md)`;
const status = (g) => `${meta(g.status).icon} ${g.status}`;

/** A one-line status bar: BAR_CELLS squares split by share (largest
 *  remainder), every status that has games gets at least one square. */
function bar(list) {
  const total = list.length;
  const raw = STATUSES.map((s) => ({ s, v: count(s.name, list) * BAR_CELLS / total }));
  const cells = raw.map((x) => ({ ...x, c: x.v > 0 ? Math.max(1, Math.floor(x.v)) : 0 }));
  let left = BAR_CELLS - cells.reduce((a, x) => a + x.c, 0);
  for (const x of [...cells].sort((a, b) => (b.v % 1) - (a.v % 1))) if (left > 0 && x.v > 0) { x.c++; left--; }
  while (left < 0) { const big = cells.reduce((a, b) => (b.c > a.c ? b : a)); big.c--; left++; }
  return cells.map((x) => x.s.cell.repeat(x.c)).join("");
}
const counts = (list) => STATUSES.filter((s) => count(s.name, list)).map((s) => `${s.icon} ${count(s.name, list)} ${s.name.toLowerCase()}`).join(" · ");

// --- docs/compatibility/README.md: stats block ----------------------------
const groups = new Map();
for (const g of games) {
  const k = g.group || "Other games";
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(g);
}
const groupRows = [...groups].sort(([a], [b]) => (a === "Other games") - (b === "Other games") || a.localeCompare(b));
const recent = [...games].sort((a, b) => b.tested.localeCompare(a.tested) || a.title.localeCompare(b.title)).slice(0, RECENT);

const stats = [
  `**${n(tested)} of ${n(TOTAL)} games tested (${pct(tested, TOTAL)} %).** ${counts(games)}.`,
  "",
  `${bar(games)} &nbsp;tested games by status`,
  "",
  "| | Status | Games | Share of tested |",
  "|---|---|---:|---:|",
  ...STATUSES.map((s) => `| ${s.icon} | ${s.name} | ${count(s.name)} | ${pct(count(s.name), tested)} % |`),
  "",
  `**Find a game:** [all tested games A–Z](GAMES.md) · [searchable table](games.csv) (filter by title, status, backend) · `
    + "or search this folder for its title. A game not listed is untested.",
  "",
  "### By group",
  "",
  "| Group | Tested | 🟢 | 🟡 | 🟠 | 🔴 |",
  "|---|---:|---:|---:|---:|---:|",
  ...groupRows.map(([k, list]) => `| ${cell(k)} | ${list.length} | ${STATUSES.map((s) => count(s.name, list) || "").join(" | ")} |`),
  "",
  `### Recently tested`,
  "",
  "| Game | Status | Tested | Note |",
  "|---|---|---|---|",
  ...recent.map((g) => `| ${link(g, "games/")} (${g.year}) | ${status(g)} | ${g.tested} | ${cell(g.note) || "—"} |`),
].join("\n");

// --- GAMES.md (+ list/<letter>.md when large) ------------------------------
const letters = new Map();
for (const g of byTitle) {
  const l = letterOf(g);
  if (!letters.has(l)) letters.set(l, []);
  letters.get(l).push(g);
}
const anchor = (l) => (l === "#" ? "0-9" : l.toLowerCase());
const heading = (l) => (l === "#" ? "0–9" : l);
const tableHead = ["| Game | Year | Status | Backend | Note |", "|---|---:|---|---|---|"];
const tableRow = (g, base) => `| ${link(g, base)} | ${g.year} | ${status(g)} | ${g.backend} | ${cell(g.note) || "—"} |`;
const GEN = "<!-- generated by tools/compat-index.mjs from the game pages; do not edit -->";
const intro = (back) => [
  GEN, "", "# Tested games", "",
  `[← Compatibility](${back}README.md) · ${n(tested)} games · ${counts(games)} · [searchable table](${back}games.csv)`, "",
];

const listDir = join(DIR, "list");
if (existsSync(listDir)) rmSync(listDir, { recursive: true });
let gamesMd;
if (tested <= SPLIT_AT) {
  gamesMd = [
    ...intro(""),
    [...letters.keys()].map((l) => `[${heading(l)}](#${anchor(l)})`).join(" · "), "",
    ...[...letters].flatMap(([l, gs]) => [`## ${heading(l)}`, "", ...tableHead, ...gs.map((g) => tableRow(g, "games/")), ""]),
  ];
} else {
  mkdirSync(listDir);
  for (const [l, gs] of letters) {
    const file = l === "#" ? "0-9" : l;
    writeFileSync(join(listDir, `${file}.md`), [
      GEN, "", `# Tested games: ${heading(l)}`, "",
      `[← All letters](../GAMES.md) · ${gs.length} games · ${counts(gs)}`, "",
      ...tableHead, ...gs.map((g) => tableRow(g, "../games/")), "",
    ].join("\n"));
  }
  gamesMd = [
    ...intro(""),
    "| Letter | Games | Status |", "|---|---:|---|",
    ...[...letters].map(([l, gs]) => `| [${heading(l)}](list/${l === "#" ? "0-9" : l}.md) | ${gs.length} | ${counts(gs)} |`), "",
  ];
}
writeFileSync(join(DIR, "GAMES.md"), gamesMd.join("\n").trimEnd() + "\n");

// --- games.csv -------------------------------------------------------------
const csvCols = ["title", "year", "status", "backend", "group", "tested", "note", "id", "code"];
const csvCell = (v) => { const s = String(v ?? "").replace(/`/g, ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
writeFileSync(join(DIR, "games.csv"), [csvCols.join(","), ...byTitle.map((g) => csvCols.map((c) => csvCell(g[c])).join(","))].join("\n") + "\n");

// --- README.md summary -----------------------------------------------------
const summary = `${bar(games)} **${n(tested)} of ${n(TOTAL)} games tested:** ${counts(games)}. ` +
  "[All tested games](docs/compatibility/GAMES.md) · [searchable table](docs/compatibility/games.csv)";

function fill(text, key, body, file) {
  const re = new RegExp(`(<!-- generated:${key}[^>]*-->\\n)[\\s\\S]*?(<!-- /generated:${key} -->)`);
  if (!re.test(text)) throw new Error(`${file}: no <!-- generated:${key} --> block`);
  return text.replace(re, (_, a, b) => `${a}${body}\n${b}`);
}
writeFileSync(COMPAT, fill(readFileSync(COMPAT, "utf8"), "stats", stats, COMPAT));
writeFileSync(README, fill(readFileSync(README, "utf8"), "tested", summary, README));
console.log(`tested ${tested}/${TOTAL}: ` + STATUSES.map((s) => `${s.name} ${count(s.name)}`).join(", ") +
  (tested > SPLIT_AT ? ` (GAMES.md split into ${letters.size} letter pages)` : ""));
