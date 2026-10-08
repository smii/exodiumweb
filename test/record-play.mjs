// Record a screen video of finding a game, starting it and playing a few
// seconds, then closing the player. Usage:
//   node record-play.mjs <baseUrl> "<search text>" "<card title>" [menuKey] [seconds]
import { chromium } from "playwright";
import { mkdirSync, renameSync } from "node:fs";

const [base = "http://localhost:8090", search = "Commander Keen 5", title = search, menuKey = "", secs = "20"] = process.argv.slice(2);
const dir = new URL("./videos/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"];
const opts = { viewport: { width: 1280, height: 800 }, recordVideo: { dir, size: { width: 1280, height: 800 } } };
// PROFILE=<dir>: a persistent browser profile, so storage quota and kept
// downloads behave like a real browser (the default context is incognito-like).
const launched = process.env.PROFILE ? null : await chromium.launch({ args });
const context = launched ? await launched.newContext(opts) : await chromium.launchPersistentContext(process.env.PROFILE, { ...opts, args });
const browser = { close: async () => { await launched?.close(); } };
const page = await context.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

const t0 = Date.now();
await page.goto(base);
await page.waitForTimeout(2500);
// Once a user has played something the app opens on My Library; search the whole collection.
await page.getByText(/^\s*Browse/).first().click();
await page.waitForTimeout(800);
await page.getByPlaceholder(/search games/i).click();
await page.keyboard.type(search, { delay: 90 });
await page.waitForTimeout(1800);
// Open the card's detail panel, then press its Play button.
const card = page.getByText(title, { exact: true }).first();
try {
  await card.click({ timeout: 15000 });
} catch (e) {
  await page.screenshot({ path: new URL(`./shots/${slug}-search-failed.png`, import.meta.url).pathname });
  throw e;
}
await page.waitForTimeout(1800);
await page.screenshot({ path: new URL(`./shots/${slug}-detail.png`, import.meta.url).pathname });
await page.locator(".game-detail-panel button", { hasText: "Play" }).first().click();

const frame = page.frameLocator("#notexoweb-player");
const handle = await page.waitForSelector("#notexoweb-player", { timeout: 15000 });
const f = await handle.contentFrame();
// Large games ask before downloading: capture the question and the progress.
const ask = frame.getByRole("button", { name: /^Download/ });
const asked = await Promise.race([
  ask.waitFor({ timeout: 600000 }).then(() => true),
  f.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 600000 }).then(() => false),
]);
if (asked) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: new URL(`./shots/${slug}-ask.png`, import.meta.url).pathname });
  await ask.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: new URL(`./shots/${slug}-downloading.png`, import.meta.url).pathname });
}
await f.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 600000 });
const err = await f.evaluate(() => window.__player.error);
console.log(`player ${err ? "ERROR " + err : "ready"} after ${Date.now() - t0} ms`);
await page.waitForTimeout(5000);
if (menuKey) {
  // Comma-separated keys, pressed a few seconds apart (eXo menus, then the game's own prompts).
  await frame.locator("#dos").click({ position: { x: 600, y: 400 } }).catch(() => {});
  for (const key of menuKey.split(",")) {
    await page.keyboard.press(key);
    await page.waitForTimeout(4000);
  }
}
await page.waitForTimeout(Number(secs) * 1000);
await page.screenshot({ path: new URL(`./shots/${slug}-playing.png`, import.meta.url).pathname });
await frame.locator("#close").click();
await page.waitForTimeout(2000);
await page.screenshot({ path: new URL(`./shots/${slug}-after.png`, import.meta.url).pathname });

const video = page.video();
await context.close();
const out = `${dir}${slug}.webm`;
renameSync(await video.path(), out);
console.log(`video: ${out}`);
for (const p of problems.slice(0, 10)) console.log(p);
await browser.close();
