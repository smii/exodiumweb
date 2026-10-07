// Boot each PoC game in headless Chromium and check it reaches a non-black screen.
// Usage: node boot-test.mjs [baseUrl] [short ...]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

// Key to press at eXo's run.bat menu; default "1". Furcol's 3DFX mode is 2.
const MENU_KEY = { Furcol: "2" };

// Share of non-black pixels in the visible emulator area (works for the
// worker/OffscreenCanvas path, where ci.screenshot() has no frames).
async function litPercent(page) {
  const box = page.locator("#dos canvas").first();
  const buf = await box.screenshot().catch(() => null);
  if (!buf) return null;
  const png = PNG.sync.read(buf);
  let on = 0;
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i] + png.data[i + 1] + png.data[i + 2] > 30) on++;
  return { w: png.width, h: png.height, pct: Math.round((on * 100) / (png.data.length / 4)) };
}

const base = process.argv[2] ?? "http://localhost:8090";
const only = process.argv.slice(3);
const SHOTS = new URL("./shots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const games = await (await fetch(`${base}/api/games`)).json();
const browser = await chromium.launch({
  // SwiftShader gives the headless shell a software WebGL for the 3dfx path.
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
});

const results = [];
for (const g of games) {
  if (only.length && !only.includes(g.short)) continue;
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

  const t0 = Date.now();
  await page.goto(`${base}/play.html?g=${encodeURIComponent(g.short)}`);
  let ready = false;
  try {
    await page.waitForFunction(() => window.__poc?.ready || window.__poc?.error, null, { timeout: 90_000 });
    ready = await page.evaluate(() => window.__poc.ready);
  } catch { /* timeout: reported below */ }
  const bootMs = Date.now() - t0;

  // eXo launch menus (run.bat) wait on `choice`; pick option 1.
  await page.waitForTimeout(6000);
  if (ready) {
    await page.click("#dos").catch(() => {});
    await page.keyboard.press(MENU_KEY[g.short] ?? "1").catch(() => {});
    await page.waitForTimeout(10000);
  }

  const lit = ready ? await litPercent(page) : null;
  const pocError = await page.evaluate(() => window.__poc?.error ?? null);
  const events = await page.evaluate(() => window.__poc?.events ?? []);
  await page.screenshot({ path: `${SHOTS}${g.short}.png` });

  const r = { short: g.short, title: g.title, feature: g.feature, ready, bootMs, lit, events, pocError, errors: errors.slice(0, 5) };
  results.push(r);
  console.log(`${ready && lit?.pct > 1 ? "PASS" : "FAIL"} ${g.short.padEnd(9)} ${g.feature.padEnd(12)} ready=${ready} boot=${bootMs}ms screen=${JSON.stringify(lit)} ${pocError ?? ""} ${errors[0] ?? ""}`);
  await page.close();
}
await browser.close();
writeFileSync(new URL("./last-run.json", import.meta.url), JSON.stringify(results, null, 1));
