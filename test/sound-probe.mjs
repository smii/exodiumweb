// Does a game make sound? Boots games in the player, taps the audio js-dos
// plays (its ScriptProcessor output), and reports loudness per second, a WAV
// of the output and screenshots after each key step.
//   node sound-probe.mjs <baseUrl> <plan.json>
// plan.json: [{ "id": 2305, "name": "keen5", "keys": "Enter:5,Space:8", "secs": 20 }, ...]
// Keys as in keys-steps.mjs ("key" or "key:seconds-after"). REMOTE_USER as in
// record-play.mjs. GESTURE=1 starts Chromium with the normal autoplay policy
// (audio only after a click/key), like a real browser.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [base = "http://localhost:8090", planFile = "sound-plan.json"] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(planFile, "utf8"));
const out = new URL("./shots/sound/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
args.push(process.env.GESTURE === "1" ? "--autoplay-policy=document-user-activation-required" : "--autoplay-policy=no-user-gesture-required");
// VIA_FRAME=1: open the player the way the app does -- a click in the parent
// page, a server round trip, then an <iframe allow="autoplay"> -- instead of
// loading player.html as the top page.
const viaFrame = process.env.VIA_FRAME === "1";
const browser = await chromium.launch({ args });
const ctxOpts = { viewport: { width: 960, height: 680 } };
if (process.env.REMOTE_USER) ctxOpts.extraHTTPHeaders = { "Remote-User": process.env.REMOTE_USER };

// Runs in the page before js-dos: wraps every ScriptProcessor's onaudioprocess
// so the samples it writes are measured (RMS per callback) and kept (8 kHz).
const tap = () => {
  const A = (window.__audio = { blocks: [], states: [], rate: 0, keep: [], keepStep: 1 });
  const orig = AudioContext.prototype.createScriptProcessor;
  AudioContext.prototype.createScriptProcessor = function (...a) {
    const node = orig.apply(this, a);
    const ctx = this;
    A.rate = ctx.sampleRate;
    A.keepStep = Math.max(1, Math.round(ctx.sampleRate / 8000));
    A.states.push([performance.now(), ctx.state]);
    ctx.addEventListener("statechange", () => A.states.push([performance.now(), ctx.state]));
    // Call js-dos's handler first, then measure what it wrote.
    const native = Object.getOwnPropertyDescriptor(ScriptProcessorNode.prototype, "onaudioprocess");
    let handler = null;
    Object.defineProperty(node, "onaudioprocess", {
      get: () => handler,
      set: (h) => {
        handler = h;
        native.set.call(node, (e) => {
          h(e);
          const d = e.outputBuffer.getChannelData(0);
          let s = 0, peak = 0;
          for (let i = 0; i < d.length; i++) { s += d[i] * d[i]; const v = Math.abs(d[i]); if (v > peak) peak = v; }
          A.blocks.push([performance.now(), Math.sqrt(s / d.length), peak, ctx.state]);
          for (let i = 0; i < d.length; i += A.keepStep) A.keep.push(d[i]);
        });
      },
    });
    return node;
  };
  // Secure contexts (https, localhost): js-dos's emulators.js plays through an
  // AudioWorklet fixed at 44100 Hz and posts sample chunks to its port. Count
  // what arrives per second: that is the emulator's real output rate.
  const OrigWorklet = window.AudioWorkletNode;
  if (OrigWorklet) {
    window.AudioWorkletNode = function (ctx, name, opts) {
      const node = new OrigWorklet(ctx, name, opts);
      A.rate = ctx.sampleRate;
      A.worklet = true;
      A.keepStep = Math.max(1, Math.round(ctx.sampleRate / 8000));
      A.states.push([performance.now(), ctx.state]);
      ctx.addEventListener("statechange", () => A.states.push([performance.now(), ctx.state]));
      A.pushed = [];
      const post = node.port.postMessage.bind(node.port);
      node.port.postMessage = (d, t) => {
        if (d instanceof Float32Array) {
          let s = 0, peak = 0;
          for (let i = 0; i < d.length; i++) { s += d[i] * d[i]; const v = Math.abs(d[i]); if (v > peak) peak = v; }
          A.blocks.push([performance.now(), Math.sqrt(s / d.length), peak, ctx.state]);
          A.pushed.push([performance.now(), d.length]);
          for (let i = 0; i < d.length; i += A.keepStep) A.keep.push(d[i]);
        }
        return post(d, t);
      };
      return node;
    };
    window.AudioWorkletNode.prototype = OrigWorklet.prototype;
    // The samples may come from js-dos's worker, out of reach here; count
    // them inside the worklet itself and report once a second via console.
    const prelude = `{
      const reg = globalThis.registerProcessor;
      globalThis.registerProcessor = (name, Cls) => reg(name, class extends Cls {
        constructor(...a) {
          super(...a);
          this.__in = 0; this.__sq = 0; this.__n = 0; this.__peak = 0; this.__t = currentTime;
          const h = this.port.onmessage;
          this.port.onmessage = (e) => { if (e.data instanceof Float32Array) this.__in += e.data.length; h.call(this, e); };
        }
        process(i, o, p) {
          const r = super.process(i, o, p);
          const d = o[0][0];
          for (let k = 0; k < d.length; k++) { this.__sq += d[k] * d[k]; const v = Math.abs(d[k]); if (v > this.__peak) this.__peak = v; }
          this.__n += d.length;
          if (currentTime - this.__t >= 1) {
            console.log("[probe] in=" + this.__in + " out=" + this.__n + " rms=" + Math.sqrt(this.__sq / this.__n).toFixed(4) + " peak=" + this.__peak.toFixed(3));
            this.__in = 0; this.__sq = 0; this.__n = 0; this.__peak = 0; this.__t = currentTime;
          }
          return r;
        }
      });
    }\n`;
    const addModule = AudioWorklet.prototype.addModule;
    AudioWorklet.prototype.addModule = async function (url, o) {
      const src = await (await fetch(url)).text();
      return addModule.call(this, URL.createObjectURL(new Blob([prelude + src], { type: "application/javascript" })), o);
    };
  }
};

function wav(samples, rate) {
  const n = samples.length, buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return buf;
}

const summary = [];
for (const g of plan) {
  const context = await browser.newContext(ctxOpts);
  await context.addInitScript(tap);
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  let drops = 0;
  const wl = [];
  page.on("console", (m) => {
    const t = m.text();
    if (/dropping samples/.test(t)) drops++;
    const w = t.match(/^\[probe\] in=(\d+) out=(\d+) rms=([\d.]+) peak=([\d.]+)/);
    if (w) wl.push(w.slice(1).map(Number));
  });
  const extra = (g.backend ? `&backend=${g.backend}` : "") + (g.tune ? `&tune=${encodeURIComponent(g.tune)}` : "");
  const src = `/player.html?id=${g.id}&autodownload=1${extra}`;
  let doc = page;
  if (viaFrame) {
    await page.goto(`${base}/downloads.html`);
    await page.evaluate((src) => {
      const b = Object.assign(document.createElement("button"), { id: "go", textContent: "Play" });
      b.style.cssText = "position:fixed;top:10px;left:10px;z-index:9";
      b.onclick = async () => {
        await fetch("/healthz");
        const f = Object.assign(document.createElement("iframe"), { id: "exodiumweb-player", src, allow: "fullscreen; autoplay; gamepad; clipboard-write" });
        f.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;z-index:99;background:#000";
        document.body.append(f);
        f.focus();
      };
      document.body.append(b);
    }, src);
    await page.click("#go");
    const h = await page.waitForSelector("#exodiumweb-player");
    doc = await h.contentFrame();
    await doc.waitForLoadState();
  } else {
    await page.goto(`${base}${src}`);
  }
  try {
    await doc.waitForFunction(() => window.__player?.ready || window.__player?.error, null, { timeout: 600000 });
  } catch { errs.push("player not ready in time"); }
  // THROTTLE=n: CDP CPU throttling (n-times slower) once the player is ready.
  if (process.env.THROTTLE) await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.THROTTLE) });
  const t0 = await doc.evaluate(() => performance.now());
  // Worker mode: the emulator posts sample chunks to the worklet's port from
  // its worker. Count them there, per second (loudness + samples per second).
  for (const w of page.workers()) {
    await w.evaluate(() => {
      if (self.__probe) return;
      const P = (self.__probe = { secs: [], cur: null });
      const pm = MessagePort.prototype.postMessage;
      MessagePort.prototype.postMessage = function (d, t) {
        if (d instanceof Float32Array) {
          const sec = Math.floor(performance.now() / 1000);
          if (!P.cur || P.cur.sec !== sec) { P.cur = { sec, n: 0, sq: 0, peak: 0 }; P.secs.push(P.cur); }
          for (let i = 0; i < d.length; i++) { P.cur.sq += d[i] * d[i]; const v = Math.abs(d[i]); if (v > P.cur.peak) P.cur.peak = v; }
          P.cur.n += d.length;
        }
        return pm.call(this, d, t);
      };
    }).catch(() => {});
  }
  const marks = [];
  await page.waitForTimeout((g.wait ?? 6) * 1000);
  const before = await doc.evaluate(() => window.__audio.states.at(-1)?.[1] ?? "none");
  let i = 0;
  for (const step of (g.keys ?? "").split(",").filter(Boolean)) {
    const [key, wait] = step.split(":");
    if (key !== "-") {
      // NOCLICK=1: keys only, like a player who never touches the mouse.
      if (process.env.NOCLICK !== "1") await page.mouse.click(480, 340);
      // Held briefly: games that poll the keyboard miss an instant press.
      await page.keyboard.down(key);
      await page.waitForTimeout(150);
      await page.keyboard.up(key);
    }
    marks.push([(await doc.evaluate(() => performance.now())) - t0, key]);
    await page.waitForTimeout(Number(wait ?? 4) * 1000);
    await page.screenshot({ path: `${out}${g.name}-${String(++i).padStart(2, "0")}-${key.replace(/[^a-z0-9]/gi, "_")}.png` });
  }
  await page.waitForTimeout((g.secs ?? 15) * 1000);
  await page.screenshot({ path: `${out}${g.name}-zz-end.png` });
  const a = await doc.evaluate(() => ({ ...window.__audio, keep: Array.from(window.__audio.keep) }));
  const audioRate = a.rate ? Math.round(a.rate / a.keepStep) : 8000;
  writeFileSync(`${out}${g.name}.wav`, wav(a.keep, audioRate));
  // Loudness per second since the player was ready.
  const perSec = [];
  for (const [t, rms, peak] of a.blocks) {
    const s = Math.floor((t - t0) / 1000);
    if (s < 0) continue;
    perSec[s] = Math.max(perSec[s] ?? 0, rms);
  }
  if (a.wl) for (let k = 0; k < a.wl.length; k++) perSec[k] = a.wl[k][2];
  // Emulator output rate (worklet path): samples posted per second, middle of the run.
  let outRate = null;
  for (const w of page.workers()) {
    const secs = await w.evaluate(() => self.__probe?.secs ?? []).catch(() => []);
    if (secs.length > 4) {
      const mid = secs.slice(1, -1);
      outRate = Math.round(mid.reduce((n, x) => n + x.n, 0) / mid.length);
      perSec.length = 0;
      mid.forEach((x, k) => (perSec[k] = Math.sqrt(x.sq / Math.max(1, x.n))));
      a.workerSecs = secs.length;
    }
  }
  if (wl.length > 6) {
    const mid = wl.slice(5);
    outRate = Math.round(mid.reduce((n, w) => n + w[0], 0) / mid.length);
    a.wl = wl;
  }
  if (a.pushed?.length > 10) {
    const p = a.pushed.filter(([t]) => t - t0 > 5000);
    if (p.length > 2) outRate = Math.round(p.slice(1).reduce((n, [, l]) => n + l, 0) / ((p.at(-1)[0] - p[0][0]) / 1000));
  }
  const line = perSec.map((v) => (v === undefined ? " " : v < 0.001 ? "." : v < 0.01 ? "-" : v < 0.05 ? "=" : "#")).join("");
  const loudSecs = perSec.filter((v) => v >= 0.01).length;
  const r = { id: g.id, name: g.name, before, worklet: !!a.worklet, outRate, drops, rate: a.rate, states: a.states.map(([, s]) => s), blocks: a.blocks.length, loudSecs, maxRms: Math.max(0, ...perSec.filter(Boolean)).toFixed(3), marks: marks.map(([t, k]) => `${k}@${(t / 1000).toFixed(0)}s`), errs: errs.slice(0, 3) };
  summary.push(r);
  console.log(`${g.name.padEnd(12)} ${a.worklet ? "worklet" : "scriptproc"} ctxRate=${a.rate} emuRate=${outRate} drops=${drops} beforeKeys=${before} ctx=${r.states.join(">")} loud=${loudSecs}s max=${r.maxRms} ${errs.length ? "ERR " + errs[0] : ""}`);
  console.log(`  ${line}`);
  console.log(`  keys: ${r.marks.join(" ")}`);
  await context.close();
}
writeFileSync(`${out}summary.json`, JSON.stringify(summary, null, 1));
await browser.close();
