// Does a large bundle survive the real path (browser -> Traefik/HTTP2 -> pod)?
//   RUN_WRAPPER=no-server.sh bash run-detached.sh start dl 600 node probe-live-download.mjs [base] [gameId]
// Logs in to Authelia as smii (password read from the credentials file, never printed).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const [base = "https://exo.rtm.kubernative.io", id = "2647"] = process.argv.slice(2);
const pw = readFileSync("/home/smii/.homelab-credentials", "utf8").match(/Shared password\s*:\s*(\S+)/)[1];
const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
const page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
await page.goto(base);
await page.waitForSelector("input#username-textfield, input[name=username], #username-textfield", { timeout: 30000 }).catch(() => {});
if (page.url().includes("authelia")) {
  await page.locator("input").first().fill("smii");
  await page.locator("input[type=password]").fill(pw);
  await page.locator("input[type=password]").press("Enter");
  await page.waitForTimeout(4000);
  console.log("after login url:", page.url().split("?")[0], "|", (await page.locator("body").innerText()).slice(0, 200).replace(/\n/g, " / "));
  await page.screenshot({ path: "runs/dl/login.png" });
  await page.waitForURL((u) => u.host.startsWith("exo."), { timeout: 30000 });
}
console.log("logged in, at", new URL(page.url()).host);
await page.goto(`${base}/player.html?id=${id}&autodownload=0`);
const r = await page.evaluate(async (id) => {
  const info = await (await fetch(`/api/play/${id}`)).json();
  const url = info.bundleUrl;
  const out = { bytes: info.bundleBytes, secure: isSecureContext };
  let t = Date.now();
  try {
    const res = await fetch(url);
    out.proto = performance.getEntriesByName(res.url).pop()?.nextHopProtocol;
    let n = 0;
    for await (const c of res.body) n += c.length;
    out.stream = { got: n, ms: Date.now() - t };
  } catch (e) { out.stream = { error: String(e) }; }
  t = Date.now();
  try {
    const c = await caches.open("probe");
    await c.put(url, await fetch(url));
    out.cachePut = { ok: true, ms: Date.now() - t };
    await caches.delete("probe");
  } catch (e) { out.cachePut = { error: String(e) }; }
  const est = await navigator.storage.estimate();
  out.quotaMB = Math.round(est.quota / 1e6);
  return out;
}, id);
console.log(JSON.stringify(r, null, 1));
await browser.close();
