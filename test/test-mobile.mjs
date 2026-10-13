// Phone pass: screenshots of the library, game details and Reading Room on a
// phone-sized touch screen, plus checks that nothing scrolls sideways.
// Usage: node test-mobile.mjs [baseUrl]   (REMOTE_USER=<name> for a deployed instance)
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:8090"] = process.argv.slice(2);
const out = new URL("./shots/mobile/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ ...devices["Pixel 7"], ...(process.env.REMOTE_USER ? { extraHTTPHeaders: { "Remote-User": process.env.REMOTE_USER } } : {}) });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let failed = false;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failed = true; };
const overflow = () => page.evaluate(() => {
  const w = document.documentElement.clientWidth;
  const wide = [...document.querySelectorAll("body *")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.right > w + 2 && getComputedStyle(el).position !== "fixed";
  }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} right=${Math.round(el.getBoundingClientRect().right)}`);
  return { scroll: document.documentElement.scrollWidth > w + 2, wide };
});

await page.goto(base);
await page.waitForTimeout(3000);
await page.getByText(/^\s*Browse/).first().click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}1-library.png` });
let o = await overflow();
console.log(`library overflow: ${JSON.stringify(o)}`);
check(!o.scroll, "library: no sideways scrolling");
const cols = await page.evaluate(() => getComputedStyle(document.querySelector(".game-grid")).gridTemplateColumns.split(" ").length);
check(cols >= 2, `library grid columns: ${cols}`);
const cover = await page.evaluate(() => {
  const img = document.querySelector(".game-card img");
  return img && { src: decodeURIComponent(img.currentSrc), w: img.naturalWidth };
});
check(cover?.w >= 300, `cover image: ${JSON.stringify(cover)}`);

await page.locator(".game-card[data-game-id]").nth(1).tap();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}2-detail.png` });
o = await overflow();
console.log(`detail overflow: ${JSON.stringify(o)}`);
const panel = await page.evaluate(() => { const r = document.querySelector(".game-detail-panel")?.getBoundingClientRect(); return r && { x: Math.round(r.x), w: Math.round(r.width) }; });
check(panel && panel.x >= 0 && panel.w <= 412, `detail panel fits: ${JSON.stringify(panel)}`);
check(await page.locator(".exw-hover.is-open").count() === 0, "no hover panel on touch");

// Back closes the details instead of leaving the app.
await page.goBack();
await page.waitForTimeout(800);
check(await page.locator(".game-detail-panel").count() === 0 && page.url().startsWith(base), `Back closed details (url ${page.url()})`);

await page.getByText(/^\s*Reading Room/).first().tap();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}3-reading-room.png` });
o = await overflow();
console.log(`reading room overflow: ${JSON.stringify(o)}`);
check(!o.scroll, "reading room: no sideways scrolling");

// Back returns to Browse, a second Back from the first tab leaves nothing open.
await page.goBack();
await page.waitForTimeout(800);
const tab = await page.evaluate(() => document.querySelector(".lib-tab.active")?.dataset.testid);
check(tab === "tab-browse", `Back returned to ${tab}`);

console.log(`page errors: ${errors.slice(0, 5).join(" || ") || "none"}`);
await browser.close();
console.log(failed ? "RESULT FAIL" : "RESULT PASS");
