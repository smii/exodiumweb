// Saves round-trip: boot a game, write a marker file into its drive, save
// (Close button = save + stop), reopen the player, and read the marker back.
// Usage: node test-saves.mjs <baseUrl> <gameId> <dir inside the bundle, e.g. CKeen5>
import { chromium } from "playwright";

const [base = "http://localhost:8090", id = "2305", gameDir = "CKeen5"] = process.argv.slice(2);
const marker = `exodiumweb save test ${new Date().toISOString()}`;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function boot() {
  await page.goto(`${base}/player.html?id=${id}`);
  await page.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__player.error);
  if (err) throw new Error(err);
  await page.waitForTimeout(3000);
}

await page.request.delete(`${base}/api/saves/${id}`);
await boot();
const path = `${gameDir}/SAVETEST.TXT`;
await page.evaluate(async ([p, text]) => {
  await window.__player.ci.fsWriteFile(p, new TextEncoder().encode(text));
}, [path, marker]);
// Close = save then stop; the overlay message goes nowhere outside the app.
await page.click("#close");
await page.waitForFunction(() => (window.__player.saved ?? 0) > 0, null, { timeout: 60000 });
const stored = await page.request.get(`${base}/api/saves/${id}`);
console.log(`saved on server: ${stored.status()} ${(await stored.body()).length} bytes`);

await boot();
const restored = await page.evaluate(() => window.__player.restored === true);
const back = await page.evaluate(async (p) => new TextDecoder().decode(await window.__player.ci.fsReadFile(p)), path).catch((e) => `ERR ${e.message}`);
console.log(`restored flag: ${restored}`);
console.log(back === marker ? "PASS: marker file survived save + reload" : `FAIL: read back ${JSON.stringify(back)}`);
if (errors.length) console.log("page errors:", errors.slice(0, 5));
await browser.close();
