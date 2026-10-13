// Boot a game in the player and screenshot after each key, to script
// recordings and to see where a game stops. Usage:
//   node keys-steps.mjs <baseUrl> <gameId> "<key,key,...>" [secondsBetween]
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const [base = "http://localhost:8090", id = "7085", keys = "", gap = "6"] = process.argv.slice(2);
const dir = new URL(`./shots/steps-${id}/`, import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
const all = process.env.ALL_CONSOLE === "1";
page.on("console", (m) => { if (all || /error|exit/i.test(m.text())) console.log(`console ${m.type()}: ${m.text().slice(0, 240)}`); });
// LOG_NET=1: every request the page or its workers make, and every failure.
if (process.env.LOG_NET === "1") {
  page.context().on("request", (r) => console.log(`net ${r.method()} ${r.url().slice(0, 160)}`));
  page.context().on("requestfailed", (r) => console.log(`netfail ${r.url().slice(0, 160)} ${r.failure()?.errorText}`));
}
page.on("pageerror", (e) => console.log(`pageerror: ${e.message}\n${(e.stack ?? "").split("\n").slice(0, 6).join("\n")}`));
const extra = new URLSearchParams();
if (process.env.BACKEND) extra.set("backend", process.env.BACKEND);
// CMD_FILE: DOS command lines (one per line) replacing the game's launcher.
if (process.env.CMD_FILE) extra.set("cmd", readFileSync(process.env.CMD_FILE, "utf8").trim().split(/\r?\n/).join("|"));
await page.goto(`${base}/player.html?id=${id}${extra.size ? `&${extra}` : ""}`);
await page.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 120000 });
await page.waitForTimeout(Number(gap) * 1000);
await page.screenshot({ path: `${dir}00-start.png` });
let i = 1;
// Each step is "key" or "key:seconds" (seconds to wait after it; default gap).
for (const step of keys.split(",").filter(Boolean)) {
  const [key, wait] = step.split(":");
  await page.mouse.click(500, 350);
  await page.keyboard.press(key);
  await page.waitForTimeout(Number(wait ?? gap) * 1000);
  const name = `${String(i++).padStart(2, "0")}-${key.replace(/[^a-z0-9]/gi, "_")}.png`;
  await page.screenshot({ path: `${dir}${name}` });
  console.log(`step ${name}: events=${JSON.stringify(await page.evaluate(() => window.__player.events))}`);
}
await browser.close();
