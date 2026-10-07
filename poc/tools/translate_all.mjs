// Run the translator over every eXoDOS conf and report what it decided.
// Usage: node translate_all.mjs <dir with !dos/<short>/dosbox.conf extracted> <exodium.db variants tsv>
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { translate } from "../server/translate.mjs";

const [dosDir, variantsTsv] = process.argv.slice(2);
const variant = new Map(
  readFileSync(variantsTsv, "utf8").trim().split("\n").map((l) => l.split("\t")),
);

const stats = { total: 0, dosbox: 0, dosboxX: 0, voodoo: 0, mt32: 0, ipx: 0, cd: 0, boot: 0, unrewritten: 0 };
const samples = [];
for (const short of readdirSync(dosDir)) {
  const f = join(dosDir, short, "dosbox.conf");
  if (!existsSync(f)) continue;
  const r = translate(readFileSync(f, "latin1"), { variant: variant.get(short) });
  stats.total++;
  stats[r.backend]++;
  for (const k of ["voodoo", "mt32", "ipx", "cd", "boot"]) if (r.info[k]) stats[k]++;
  // any Windows-style host path left in a mount line means the rewrite missed it
  if (/^\s*@?(img)?mount\b.*\\/im.test(r.conf.split("[autoexec]")[1] ?? "")) {
    stats.unrewritten++;
    if (samples.length < 5) samples.push([short, r.conf.split("[autoexec]")[1].trim().split("\n").slice(0, 4)]);
  }
}
console.log(stats);
for (const s of samples) console.log(s);
