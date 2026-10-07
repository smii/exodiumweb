// Screenshot the UI for progress previews.
// Usage: node preview.mjs [baseUrl] [outDir]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:8090";
const out = process.argv[3] ?? new URL("./shots/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });

await page.goto(base);
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/01-library.png` });
console.log("title:", await page.title());
console.log("visible text:", (await page.locator("body").innerText()).slice(0, 600).replace(/\n+/g, " | "));
for (const p of problems.slice(0, 15)) console.log(p);
await browser.close();
