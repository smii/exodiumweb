// Compatibility sweep: boot N random eXoDOS games straight in the player,
// press Enter/1 for launcher menus, screenshot after a while and classify.
// Usage: node sweep.mjs <baseUrl> [count=25] [seed=1] [seconds=20]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { classify } from "./classify.mjs";

const [base = "http://localhost:8090", count = "25", seed = "1", secs = "20"] = process.argv.slice(2);
const out = new URL(`./shots/sweep-${seed}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });

// Deterministic sample (by seed) so a sweep can be re-run after a fix.
const db = new DatabaseSync(new URL("../server/data/catalog.db", import.meta.url).pathname, { readOnly: true });
const all = db.prepare("SELECT id, title, year, dosbox_variant FROM games WHERE torrent_source = 'eXoDOS' ORDER BY id").all();
let s = Number(seed) * 2654435761 % 2 ** 32;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const picks = [];
while (picks.length < Number(count)) {
  const g = all[Math.floor(rnd() * all.length)];
  if (!picks.includes(g)) picks.push(g);
}

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results = [];
for (const g of picks) {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const t0 = Date.now();
  let ready = false;
  let err = null;
  try {
    await page.goto(`${base}/player.html?id=${g.id}`);
    await page.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 180000 });
    err = await page.evaluate(() => window.__player.error);
    ready = !err;
  } catch (e) { err = `timeout: ${e.message.split("\n")[0]}`; }
  const bootMs = Date.now() - t0;
  if (ready) {
    // eXo launch menus usually take 1 or Enter; nudge both, slowly.
    await page.waitForTimeout(5000);
    await page.mouse.click(480, 320);
    await page.keyboard.press("1");
    await page.waitForTimeout(3000);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(Number(secs) * 1000);
  }
  const file = `${out}${g.id}.png`;
  const buf = await page.screenshot({ path: file });
  const shot = classify(buf);
  const crashed = errs.some((m) => /unreachable|RuntimeError|abort/i.test(m));
  const verdict = !ready ? "FAIL" : crashed ? "CRASH" : shot.verdict;
  const r = { id: g.id, title: g.title, year: g.year, variant: g.dosbox_variant, verdict, bootMs, colours: shot.colours, litPct: shot.litPct, err, errs: errs.slice(0, 3) };
  results.push(r);
  console.log(`${verdict.padEnd(8)} ${String(g.id).padStart(5)} ${g.title.slice(0, 50).padEnd(50)} boot=${bootMs}ms colours=${shot.colours} lit=${shot.litPct}% ${err ?? ""} ${errs[0] ?? ""}`);
  await page.close();
}
await browser.close();
writeFileSync(`${out}results.json`, JSON.stringify(results, null, 1));
const tally = results.reduce((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] ?? 0) + 1 }), {});
console.log("tally:", JSON.stringify(tally));
