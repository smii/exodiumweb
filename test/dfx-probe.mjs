import { chromium } from "playwright";
const base = "http://localhost:8090";
const ids = process.argv.slice(2);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
for (const id of ids) {
  const p = await (await b.newContext({ viewport: { width: 960, height: 680 } })).newPage();
  const errs = [];
  p.on("console", (m) => { const t = m.text(); if (/error|unreachable|abort|fail/i.test(t) && !/download/.test(t)) errs.push(t.slice(0, 120)); });
  p.on("pageerror", (e) => errs.push("E:" + e.message.slice(0, 120)));
  await p.goto(`${base}/player.html?id=${id}&autodownload=1`);
  try { await p.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 200000 }); } catch { errs.push("not ready"); }
  await p.waitForTimeout(20000);
  await p.screenshot({ path: `shots/sound/dfx-${id}-a.png` });
  await p.mouse.click(480, 340);
  await p.keyboard.press(process.env["K"+id]||"1"); await p.waitForTimeout(25000); if(process.env["L"+id]) { await p.keyboard.press(process.env["L"+id]); await p.waitForTimeout(40000); }
  await p.screenshot({ path: `shots/sound/dfx-${id}-c.png` });
  console.log(id, JSON.stringify(errs.slice(0, 4)));
  await p.context().close();
}
await b.close();
