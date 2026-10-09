// Browser Back while a game runs must close the game (saving first) and stay
// in the app, not leave it (in production the previous page is Authelia's
// login). Usage: node test-back.mjs [baseUrl] ["search"] ["card title"]
import { chromium } from "playwright";

const [base = "http://localhost:8090", search = "Commander Keen 5", title = "Commander Keen 5: The Armageddon Machine"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...(process.env.REMOTE_USER ? { extraHTTPHeaders: { "Remote-User": process.env.REMOTE_USER } } : {}) });
const page = await ctx.newPage();
let failed = false;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failed = true; };

await page.goto(`${base}/healthz`); // stands in for the page before the app (Authelia's login)
await page.goto(base);
await page.waitForTimeout(2500);
const startTab = await page.evaluate(() => document.querySelector(".lib-tab.active")?.dataset.testid);
await page.getByText(/^\s*Browse/).first().click();
await page.getByPlaceholder(/search games/i).fill(search);
await page.waitForTimeout(1500);
await page.getByText(title, { exact: true }).first().click();
await page.waitForTimeout(1200);
await page.locator(".game-detail-panel button", { hasText: "Play" }).first().click();
const f = await (await page.waitForSelector("#exodiumweb-player")).contentFrame();
await f.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 120000 });
check(await f.evaluate(() => window.__player.ready), "game started");
await page.waitForTimeout(4000);

await page.goBack();
await page.waitForSelector("#exodiumweb-player", { state: "detached", timeout: 20000 }).catch(() => {});
check(await page.locator("#exodiumweb-player").count() === 0, "Back closed the player");
check(new URL(page.url()).pathname === "/", `still in the app (${page.url()})`);
check(await page.getByPlaceholder(/search games/i).count() === 1, "library visible");

// The Close button path must not leave a stale history entry behind.
await page.locator(".game-detail-panel button", { hasText: "Play" }).first().click();
const f2 = await (await page.waitForSelector("#exodiumweb-player")).contentFrame();
await f2.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 120000 });
await page.waitForTimeout(3000);
await f2.locator("#close").click();
await page.waitForSelector("#exodiumweb-player", { state: "detached", timeout: 20000 }).catch(() => {});
check(await page.locator("#exodiumweb-player").count() === 0, "Close button closed the player");
// The game was started from its details panel: Back closes that first,
// then the next Back leaves the app as usual.
check(await page.locator(".game-detail-panel").count() === 1, "details still open after Close");
await page.goBack();
await page.waitForTimeout(1500);
check(await page.locator(".game-detail-panel").count() === 0 && !page.url().endsWith("/healthz"), `Back closed the details, still in the app (${page.url()})`);
if (startTab !== "tab-browse") {
  // The app opened on another tab (My Library when there are recent games)
  // and the test switched to Browse: Back returns to that tab first.
  await page.goBack();
  await page.waitForTimeout(1500);
  const tab = await page.evaluate(() => document.querySelector(".lib-tab.active")?.dataset.testid);
  check(tab === startTab, `Back returned to the starting tab ${startTab} (now ${tab})`);
}
await page.goBack();
await page.waitForTimeout(1500);
check(page.url().endsWith("/healthz"), `next Back leaves the app as usual (${page.url()})`);

await browser.close();
console.log(failed ? "RESULT FAIL" : "RESULT PASS");
process.exitCode = failed ? 1 : 0;
