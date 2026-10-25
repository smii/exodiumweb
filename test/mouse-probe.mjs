// Mouse-range probe: MTEST.COM (test/fixtures/MTEST.COM) limits the DOS mouse
// to x 200..300, y 100..150 in mode 13h (as an RTS does while dragging on its
// minimap), waits ~4 s and writes the final position to MOUSE.TXT, while the
// host pointer rests at (fx, fy) of the game area.
// <gameDir> is the folder the game's C: points at (e.g. CKeen5).
// MOUSE=on|off seeds the player's saved "Lock mouse" choice for this game.
// Usage: node mouse-probe.mjs <base> <id> <gameDir> <fx> <fy> [extra query, e.g. &tune=sdl.autolock%3Dtrue]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [base, id, gameDir, fx, fy, extra = ""] = process.argv.slice(2);
const step = (s) => console.log(`[${fx},${fy}] ${s}`);
const within = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${what}`)), ms))]);
const com = [...readFileSync(new URL("fixtures/MTEST.COM", import.meta.url))];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
if (process.env.MOUSE) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [`exodiumweb:mouse:${id}`, process.env.MOUSE]);
page.on("console", (m) => /error/i.test(m.type()) && step(`console: ${m.text().slice(0, 160)}`));
try {
  await page.goto(`${base}/player.html?id=${id}&cmd=${encodeURIComponent("pause|C:\\MTEST.COM")}${extra}`);
  await page.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 120000 });
  step(`ready, error=${await page.evaluate(() => window.__player.error)}, mouseCapture=${await page.evaluate(() => window.__player.mouseCapture)}`);
  await page.waitForTimeout(2000);
  await within(page.evaluate(([dir, b]) => window.__player.ci.fsWriteFile(`${dir}/MTEST.COM`, new Uint8Array(b)), [gameDir, com]), 10000, "fsWriteFile");
  step("MTEST.COM written");
  const box = await page.locator("#dos").boundingBox();
  const x = box.x + box.width * Number(fx), y = box.y + box.height * Number(fy);
  await page.mouse.move(x, y);
  await page.mouse.click(x, y); // focus the game (and lock the pointer when js-dos captures it)
  await page.keyboard.press("Enter"); // leave `pause`
  await page.waitForTimeout(1000); // MTEST sets the range
  // DRIFT=<px>: then move that far left/right in small steps (relative-mode check).
  const drift = Number(process.env.DRIFT ?? 0);
  for (let i = 1; i <= 16; i++) { await page.mouse.move(x + (drift * i) / 16 + (drift ? 0 : i % 2), y); await page.waitForTimeout(150); }
  await page.waitForTimeout(2500);
  // fsReadFile never answers for a missing file, hence the timeout.
  const where = await within(page.evaluate(async (dir) => new TextDecoder().decode(await window.__player.ci.fsReadFile(`${dir}/MOUSE.TXT`)).trim(), gameDir), 10000, "fsReadFile (no MOUSE.TXT?)");
  console.log(`pointer at ${fx},${fy} of the game area -> DOS mouse ${where}`);
  await page.screenshot({ path: `/tmp/w2/mouse-${fx}-${fy}.png` });
} catch (e) { step(`FAIL ${e.message}`); }
await browser.close();
