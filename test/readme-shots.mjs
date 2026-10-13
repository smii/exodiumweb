// README screenshots: library (with the hover info panel), Reading Room,
// game detail, a game running.
// Usage: node readme-shots.mjs [baseUrl]   (REMOTE_USER=<name> for a deployed instance)
// Writes docs/screenshots/*.png.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:8090"] = process.argv.slice(2);
const out = new URL("../docs/screenshots/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(process.env.REMOTE_USER ? { extraHTTPHeaders: { "Remote-User": process.env.REMOTE_USER } } : {}) });
const page = await ctx.newPage();

// Library, scrolled a little way in; the mouse ends on a card, so its hover
// info panel is open in the shot.
await page.goto(base);
await page.waitForTimeout(2500);
await page.getByText(/^\s*Browse/).first().click();
await page.waitForTimeout(2500);
// Scroll the grid (it scrolls inside its own container) by wheel steps.
await page.mouse.move(700, 600);
for (let i = 0; i < Number(process.env.SCROLL_STEPS ?? 20); i++) { await page.mouse.wheel(0, 600); await page.waitForTimeout(60); }
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}library.png`, timeout: 90000 });

// Reading Room (eXo's magazines, books and catalogues).
await page.getByText(/^\s*Reading Room/).first().click();
await page.waitForTimeout(5000);
await page.screenshot({ path: `${out}reading-room.png`, timeout: 90000 });
await page.getByText(/^\s*Browse/).first().click();
await page.waitForTimeout(1500);

// Game detail (box art, video, gallery).
await page.getByPlaceholder(/search games/i).click();
await page.keyboard.type("Commander Keen 5", { delay: 60 });
await page.waitForTimeout(1500);
await page.getByText("Commander Keen 5: The Armageddon Machine", { exact: true }).first().click();
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}detail.png` });

// The game running in js-dos, past the startup screen.
await page.locator(".game-detail-panel button", { hasText: "Play" }).first().click();
const f = await (await page.waitForSelector("#exodiumweb-player")).contentFrame();
await f.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 120000 });
await page.waitForTimeout(6000);
await page.mouse.click(720, 450);
await page.keyboard.press("Space");   // past "Ready - press a key"
await page.waitForTimeout(8000);
await page.keyboard.press("Enter");   // skip the intro to the main menu
await page.waitForTimeout(Number(process.env.PLAY_WAIT ?? 5000));
await page.screenshot({ path: `${out}playing.png` });
await browser.close();
console.log(`screenshots in ${out}`);
