// Re-score an existing sweep's screenshots: node reclassify.mjs <seed>
import { readFileSync, writeFileSync } from "node:fs";
import { classify } from "./classify.mjs";

const dir = new URL(`./shots/sweep-${process.argv[2] ?? 1}/`, import.meta.url).pathname;
const results = JSON.parse(readFileSync(`${dir}results.json`, "utf8"));
const tally = {};
for (const r of results) {
  if (r.verdict !== "FAIL" && r.verdict !== "CRASH") Object.assign(r, classify(readFileSync(`${dir}${r.id}.png`)));
  tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
  console.log(`${r.verdict.padEnd(8)} ${String(r.id).padStart(5)} ${r.title.slice(0, 40).padEnd(40)} colours=${r.colours} lit=${r.litPct}%`);
}
writeFileSync(`${dir}results.json`, JSON.stringify(results, null, 1));
console.log("tally:", JSON.stringify(tally));
