// Open the player for one game directly and dump its console + a screenshot.
// Usage: node debug-player.mjs <baseUrl> <gameId> [seconds]
import { chromium } from "playwright";

const [base = "http://localhost:8090", id = "7085", secs = "40"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const t0 = Date.now();
page.on("console", (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m.type()}: ${m.text().slice(0, 300)}`));
page.on("pageerror", (e) => console.log(`pageerror: ${e.message}`));
page.on("requestfinished", async (r) => {
  if (/bundle|saves|emulators\/w/.test(r.url())) console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${r.method()} ${r.url().replace(base, "")} ${(await r.response())?.status()}`);
});
await page.goto(`${base}/player.html?id=${id}`);
await page.waitForTimeout(Number(secs) * 1000);
console.log("state:", JSON.stringify(await page.evaluate(() => ({ ...window.__player, ci: !!window.__player?.ci }))));
await page.screenshot({ path: new URL(`./shots/debug-${id}.png`, import.meta.url).pathname });
await browser.close();
