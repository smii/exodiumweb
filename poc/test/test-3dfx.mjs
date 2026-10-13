// Launch Furcol's 3dfx executable and look for js-dos's Voodoo/Glide signals.
// Usage: node test-3dfx.mjs [baseUrl]
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:8090";
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));

await page.goto(`${base}/play.html?g=Furcol&cmd=${encodeURIComponent("furcol.exe -3dfx")}`);
await page.waitForFunction(() => window.__poc?.ready || window.__poc?.error, null, { timeout: 90_000 });
const webgl2 = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
for (const t of [10, 25, 45]) {
  await page.waitForTimeout(t === 10 ? 10_000 : 15_000 + (t === 45 ? 5_000 : 0));
  await page.keyboard.press("Space").catch(() => {});
  await page.screenshot({ path: new URL(`./shots/Furcol-3dfx-${t}s.png`, import.meta.url).pathname });
}
const signals = logs.filter((l) => /glide|glfx|voodoo|3dfx|webgl|error/i.test(l));
console.log(JSON.stringify({ webgl2, signals: signals.slice(0, 25), total: logs.length }, null, 1));
await browser.close();
