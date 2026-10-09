// UI pass: library look, hover info panel, Reading Room, player toolbar
// (scanlines, fullscreen + keyboard lock). Screenshots in shots/ui/.
// Usage: node test-ui.mjs [baseUrl]   (REMOTE_USER=<name> for a deployed instance)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:8090"] = process.argv.slice(2);
const out = new URL("./shots/ui/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(process.env.REMOTE_USER ? { extraHTTPHeaders: { "Remote-User": process.env.REMOTE_USER } } : {}) });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
let failed = false;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failed = true; };

// 1. Library
await page.goto(base);
await page.waitForTimeout(2500);
await page.getByText(/^\s*Browse/).first().click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}1-library.png` });
const gap = await page.evaluate(() => getComputedStyle(document.querySelector(".game-grid")).rowGap);
const border = await page.evaluate(() => getComputedStyle(document.querySelector(".game-card")).borderTopWidth);
check(gap === "22px" && border === "1px", `grid gap ${gap}, card border ${border}`);

// 2. Hover panel
const card = page.locator(".game-card[data-game-id]").nth(2);
await card.hover();
await page.waitForSelector(".exw-hover.is-open", { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(400);
const hover = await page.evaluate(() => {
  const p = document.querySelector(".exw-hover.is-open");
  return p && { title: p.querySelector(".exw-hover-title")?.textContent, desc: !!p.querySelector(".exw-hover-desc"), similar: p.querySelectorAll(".exw-hover-similar").length };
});
check(!!hover?.title, `hover panel: ${JSON.stringify(hover)}`);
await page.screenshot({ path: `${out}2-hover.png` });
await page.mouse.move(5, 5);

// 3. Reading Room
await page.getByText(/^\s*Reading Room/).first().click();
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}3-reading-room.png` });
const rrText = (await page.locator("body").innerText()).slice(0, 400).replace(/\n+/g, " | ");
console.log(`reading room text: ${rrText}`);

// 4. Player toolbar inside the library (Play from the detail panel)
await page.getByText(/^\s*Browse/).first().click();
await page.getByPlaceholder(/search games/i).fill("Commander Keen 5");
await page.waitForTimeout(1500);
await page.getByText("Commander Keen 5: The Armageddon Machine", { exact: true }).first().click();
await page.waitForTimeout(1200);
await page.locator(".game-detail-panel button", { hasText: "Play" }).first().click();
const f = await (await page.waitForSelector("#exodiumweb-player")).contentFrame();
await f.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 120000 });
await page.waitForTimeout(3000);
await f.locator("#scan").click();
await page.waitForTimeout(500);
check(await f.evaluate(() => document.body.classList.contains("scanlines")), "scanlines on");
await page.screenshot({ path: `${out}4-scanlines.png` });
const lockVisible = await f.locator("#lock").isVisible();
console.log(`lock-keys button visible: ${lockVisible}`);
if (lockVisible) await f.locator("#lock").click();
await f.locator("#full").click();
await page.waitForTimeout(1500);
const fs = await page.evaluate(() => document.fullscreenElement?.id ?? null);
check(fs === "exodiumweb-player", `fullscreen element: ${fs}`);
console.log(`fullscreen button label: ${await f.locator("#full").textContent()}`);
await page.screenshot({ path: `${out}5-fullscreen.png` });
await f.locator("#full").click();
await page.waitForTimeout(800);
check(await page.evaluate(() => !document.fullscreenElement), "left fullscreen");
await f.locator("#close").click();
await page.waitForSelector("#exodiumweb-player", { state: "detached", timeout: 20000 }).catch(() => {});

console.log(`page errors: ${errors.filter((e) => !/Keyboard|AudioContext|sampleRate/.test(e)).slice(0, 5).join(" || ") || "none"}`);
await browser.close();
console.log(failed ? "RESULT FAIL" : "RESULT PASS");
