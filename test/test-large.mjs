// Large-game flow with a small game: run the server with LARGE_BUNDLE_MB=1.
//   LARGE_BUNDLE_MB=1 bash run-detached.sh start large 240 node test-large.mjs [baseUrl] [gameId]
// 1st start: asks, downloads (progress), runs. 2nd start: from browser storage.
// downloads.html lists it; Remove empties the list. Screenshots in shots/large/.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:8090", id = "2305"] = process.argv.slice(2);
const out = new URL("./shots/large/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const fail = (m) => { console.log(`FAIL ${m}`); process.exitCode = 1; };
const ready = (page) => page.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 120000 });

// 1. First start asks before downloading.
let page = await ctx.newPage();
page.on("pageerror", (e) => console.log(`pageerror: ${e.message}`));
await page.goto(`${base}/player.html?id=${id}`);
const btn = page.getByRole("button", { name: /^Download/ });
await btn.waitFor({ timeout: 120000 });
await page.screenshot({ path: `${out}1-ask.png` });
console.log("ask shown:", await page.locator("#detail").innerText());
await btn.click();
await ready(page);
const p1 = await page.evaluate(() => ({ ...window.__player, ci: undefined }));
console.log("first start:", JSON.stringify({ ready: p1.ready, error: p1.error, downloaded: p1.downloaded }));
if (!p1.ready || !p1.downloaded) fail("first start did not download + run");
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}2-running.png` });
await page.close();

// 2. Second start comes from browser storage, no question.
page = await ctx.newPage();
await page.goto(`${base}/player.html?id=${id}`);
await ready(page);
const p2 = await page.evaluate(() => ({ ready: window.__player.ready, fromStorage: window.__player.fromStorage }));
console.log("second start:", JSON.stringify(p2));
if (!p2.ready || !p2.fromStorage) fail("second start not from storage");
await page.close();

// 3. Downloads page lists it; Remove clears it.
page = await ctx.newPage();
await page.goto(`${base}/downloads.html`);
await page.waitForSelector("#list:not([hidden]), #empty:not([hidden])");
await page.screenshot({ path: `${out}3-downloads.png` });
const rows = await page.locator("#list tbody tr").count();
console.log("downloads rows:", rows, "|", await page.locator("#usage").innerText());
if (rows !== 1) fail(`expected 1 download, got ${rows}`);
await page.getByRole("button", { name: "Remove", exact: true }).click();
await page.waitForSelector("#empty:not([hidden])");
console.log("after remove:", await page.locator("#usage").innerText());
await page.close();

// 4. Library shows the Downloads link.
page = await ctx.newPage();
await page.goto(base);
await page.waitForTimeout(3000);
console.log("library link:", await page.locator("#exodiumweb-downloads").count() === 1 ? "present" : "missing");
await page.screenshot({ path: `${out}4-library.png` });
await browser.close();
console.log(process.exitCode ? "RESULT FAIL" : "RESULT PASS");
