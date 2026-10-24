// FPS of a game in the player: counts rAF ticks that issued WebGL draw calls
// (= presented emulator frames) and rAF rate overall, per second.
//   node fps-probe.mjs <id> [backend] [cmd] [secs]
//   Dev server on :8090 (test/with-server.sh), as REMOTE_USER (default render-test, never a real user).
import { chromium } from "playwright";
const [id, backend = "", cmd = "", secs = "40"] = process.argv.slice(2);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ viewport: { width: 960, height: 680 }, extraHTTPHeaders: { "Remote-User": process.env.REMOTE_USER ?? "render-test" } });
await ctx.addInitScript(() => {
  const S = (window.__f = { draws: 0, ticks: 0, drawTicks: 0, log: [] });
  for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype])
    for (const fn of ["drawArrays", "drawElements"]) { const o = P[fn]; P[fn] = function (...a) { S.draws++; return o.apply(this, a); }; }
  let last = 0, ld = 0;
  const loop = (t) => { S.ticks++; if (S.draws !== ld) S.drawTicks++; ld = S.draws; if (t - last >= 1000) { S.log.push([S.ticks, S.drawTicks]); S.ticks = 0; S.drawTicks = 0; last = t; } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
const page = await ctx.newPage();
const q = `id=${id}&autodownload=1${backend ? `&backend=${backend}` : ""}${cmd ? `&cmd=${encodeURIComponent(cmd)}` : ""}`;
await page.goto(`http://localhost:8090/player.html?${q}`);
await page.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 200000 });
await page.waitForTimeout(Number(secs) * 1000);
// Visual frames: CDP screencast emits one frame per real visual change.
const cdp = await ctx.newCDPSession(page);
const times = [];
cdp.on("Page.screencastFrame", (f) => { times.push(Date.now()); cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); });
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 20, everyNthFrame: 1 });
await page.waitForTimeout(20000);
await cdp.send("Page.stopScreencast");
const per = Array(20).fill(0); const t0 = times[0] ?? 0; for (const t of times) { const i = Math.floor((t - t0) / 1000); if (i < 20) per[i]++; }
await page.screenshot({ path: `shots/sound/fps-${id}.png` });
console.log(id, backend || "auto", "visual frames/s:", per.join(","), "total", times.length);
await b.close();
