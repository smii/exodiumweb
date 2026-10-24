// Saves when the game quits by itself: DOS writes a file, the launcher's
// `exit` runs the quit program, the player saves and closes on its own; a
// relaunch must restore the file. Run as DEV_USER=render-test with its own STATE_DIR.
// Usage: node test-dos-save.mjs <baseUrl> <gameId> <dir inside the bundle, e.g. CKeen5>
import { chromium } from "playwright";

const [base = "http://localhost:8090", id = "2305", gameDir = "CKeen5"] = process.argv.slice(2);
const marker = `q${Date.now() % 1e8}`;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();

async function boot(cmd) {
  await page.goto(`${base}/player.html?id=${id}${process.env.BACKEND ? `&backend=${process.env.BACKEND}` : ""}${cmd ? `&cmd=${encodeURIComponent(cmd)}` : ""}`);
  await page.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__player.error);
  if (err) throw new Error(err);
}

await page.request.delete(`${base}/api/saves/${id}`);
await boot(`echo ${marker} > DOSSAVE.TXT|exit`);
await page.waitForFunction(() => window.__player.quit && (window.__player.saved ?? 0) > 0, null, { timeout: 60000 })
  .catch(() => console.log("FAIL: player did not save + close after the game quit"));
const stored = await page.request.get(`${base}/api/saves/${id}`);
console.log(`saved on server: ${stored.status()} ${(await stored.body()).length} bytes`);

await boot("dir /w");
await page.waitForTimeout(3000);
const back = await page.evaluate(async (p) => new TextDecoder().decode(await window.__player.ci.fsReadFile(p)), `${gameDir}/DOSSAVE.TXT`).catch((e) => `ERR ${e.message}`);
console.log(back.trim() === marker ? "PASS: file written by DOS survived quit + relaunch" : `FAIL: read back ${JSON.stringify(back)}`);
await browser.close();
