#!/usr/bin/env node
// Fill the resource fields of the game pages in docs/compatibility/games/:
//
//   size: 1253      download in MB (the game's zip in the collection)
//   memsize: 63     DOS memory in MB, as the translated dosbox.conf sets it
//   cycles: 100000  emulated CPU speed, as translated ("auto", "max" or a number)
//
// The numbers come from the collection, so the script runs inside the live pod:
//
//   node tools/compat-resources.mjs [--ns exodiumweb]
//
// It pipes itself into `kubectl exec` (--probe mode, which reads game codes on
// stdin and prints JSON), then rewrites those three front matter lines on each
// page. Run `node tools/compat-index.mjs` afterwards. Idempotent.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SELF = fileURLToPath(import.meta.url);
const GAMES = join(dirname(SELF), "..", "docs/compatibility/games");

if (process.argv.includes("--probe")) {
  const { Collection } = await import("/app/server/src/collection.mjs");
  const { translate } = await import("/app/server/src/translate.mjs");
  const col = new Collection(process.env);
  const meta = col.metadata("!DOSmetadata.zip");
  const names = [...meta.names()];
  const out = {};
  for (const code of process.argv[process.argv.indexOf("--probe") + 1].split(",")) {
    const prefix = `eXo/eXoDOS/!dos/${code}/`;
    const conf = col.dosboxConf(code);
    // the launcher is "<Title> (<year>).bat"; the folder also holds helpers (install.bat, exception.bat)
    const zips = names.filter((n) => n.startsWith(prefix) && /^[^/]+\.bat$/i.test(n.slice(prefix.length)))
      .map((n) => join(col.root, "eXo", "eXoDOS", n.slice(prefix.length).replace(/\.bat$/i, ".zip")))
      .filter((z) => existsSync(z));
    const zip = zips.find((z) => /\(\d{4}\)\.zip$/.test(z)) ?? zips[0];
    if (!zip || !conf) { out[code] = null; continue; }
    const t = translate(conf, {}).conf;
    const get = (k) => t.match(new RegExp(`^\\s*${k}\\s*=\\s*([^\\s#]+)`, "im"))?.[1];
    out[code] = {
      size: Math.round(statSync(zip).size / 1e4) / 100,
      memsize: get("memsize") ?? null,
      cycles: get("cycles") ?? null,
    };
  }
  console.log(JSON.stringify(out));
  process.exit(0);
}

const ns = process.argv.includes("--ns") ? process.argv[process.argv.indexOf("--ns") + 1] : "exodiumweb";
const codes = readdirSync(GAMES).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
const r = spawnSync("kubectl", ["-n", ns, "exec", "-i", "deploy/exodiumweb", "-c", "exodiumweb", "--", "node", "--input-type=module", "-", "--probe", codes.join(",")], {
  input: readFileSync(SELF), encoding: "utf8", maxBuffer: 1 << 24,
});
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
const data = JSON.parse(r.stdout.trim().split("\n").pop());

let changed = 0;
for (const code of codes) {
  const d = data[code];
  if (!d) { console.warn(`${code}: not in the collection, skipped`); continue; }
  const file = join(GAMES, `${code}.md`);
  const text = readFileSync(file, "utf8");
  const [, head, rest] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const lines = head.split("\n").filter((l) => !/^(size|memsize|cycles):/.test(l));
  const at = lines.findIndex((l) => l.startsWith("backend:")) + 1;
  const add = [`size: ${d.size}`, d.memsize && `memsize: ${d.memsize}`, d.cycles && `cycles: ${d.cycles}`].filter(Boolean);
  lines.splice(at, 0, ...add);
  const next = `---\n${lines.join("\n")}\n---\n${rest}`;
  if (next !== text) { writeFileSync(file, next); changed++; }
}
console.log(`${changed} of ${codes.length} pages updated`);
