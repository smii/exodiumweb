// Record the detail panel's media: video preview, screenshot gallery +
// lightbox, and the manual. Usage: node record-detail.mjs <baseUrl> "<search>" "<card title>"
import { chromium } from "playwright";
import { mkdirSync, renameSync } from "node:fs";

const [base = "http://localhost:8090", search = "Commander Keen 5", title = "Commander Keen 5: The Armageddon Machine"] = process.argv.slice(2);
const dir = new URL("./videos/", import.meta.url).pathname;
const shots = new URL("./shots/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
mkdirSync(shots, { recursive: true });
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir, size: { width: 1280, height: 800 } } });
const page = await context.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });

await page.goto(base);
await page.waitForTimeout(2000);
await page.getByPlaceholder(/search games/i).click();
await page.keyboard.type(search, { delay: 80 });
await page.waitForTimeout(1500);
await page.getByText(title, { exact: true }).first().click();

// The hero swaps the box art for the video preview once it's fetched.
await page.waitForTimeout(9000);
const hasVideo = await page.locator(".game-detail-panel video").count();
console.log("hero video elements:", hasVideo);
await page.screenshot({ path: `${shots}${slug}-detail-video.png` });

// Gallery strip -> lightbox.
const strip = page.locator(".game-detail-gallery-strip img");
console.log("gallery thumbnails:", await strip.count());
await page.locator(".game-detail-panel").evaluate((el) => el.scrollBy(0, 400)).catch(() => {});
await page.locator(".game-detail-panel .game-detail-media").scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${shots}${slug}-gallery.png` });
if (await strip.count()) {
  await strip.nth(Math.min(4, (await strip.count()) - 1)).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${shots}${slug}-lightbox.png` });
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
}

// Manual.
await page.locator(".game-detail-panel button", { hasText: "Manual" }).first().click().catch((e) => problems.push(`manual: ${e.message}`));
await page.waitForTimeout(6000);
await page.screenshot({ path: `${shots}${slug}-manual.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(1000);

const video = page.video();
await context.close();
renameSync(await video.path(), `${dir}${slug}-media.webm`);
console.log(`video: ${dir}${slug}-media.webm`);
for (const p of problems.slice(0, 12)) console.log(p);
await browser.close();
