// One browser/game at a time; keep evidence outside git and use an isolated user.
// node test/render-probe.mjs <player-url> <output-dir> [key:wait-seconds,...]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [url, dir, steps = "3:10,WAIT:15,Escape:5,Escape:5,Enter:5"] = process.argv.slice(2);
if (!url || !dir) throw new Error("Usage: render-probe.mjs <player-url> <output-dir> [key:seconds,...]");
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
});
const events = [];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  page.on("console", (m) => {
    if (!/dropping|audio queue/i.test(m.text())) events.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => events.push(`pageerror: ${e.stack}`));
  page.on("requestfailed", (r) => events.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 240000 });
  const error = await page.evaluate(() => window.__player.error);
  if (error) throw new Error(error);
  await page.addStyleTag({ content: "#scanlines { display: none !important; }" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(dir, "00-launcher.png") });
  await page.mouse.click(480, 360);
  let i = 0;
  for (const step of steps.split(",").filter(Boolean)) {
    const [key, seconds = "5"] = step.split(":");
    if (key !== "WAIT") {
      await page.keyboard.down(key);
      await page.waitForTimeout(150);
      await page.keyboard.up(key);
    }
    await page.waitForTimeout(Number(seconds) * 1000);
    const name = `${String(++i).padStart(2, "0")}-${key.replace(/[^a-z0-9]/gi, "_")}.png`;
    await page.screenshot({ path: join(dir, name) });
    console.log(name);
  }
  const state = await page.evaluate(() => ({
    ready: window.__player.ready, error: window.__player.error, events: window.__player.events,
    restored: window.__player.restored ?? false,
  }));
  writeFileSync(join(dir, "state.json"), JSON.stringify({ url, state }, null, 2));
} finally {
  writeFileSync(join(dir, "console.log"), events.join("\n"));
  await browser.close();
}
