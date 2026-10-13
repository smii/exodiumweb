// Contact sheet of a sweep: node contact.mjs <seed> -> shots/sweep-<seed>/contact.png
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const dir = new URL(`./shots/sweep-${process.argv[2] ?? 1}/`, import.meta.url).pathname;
const results = JSON.parse(readFileSync(`${dir}results.json`, "utf8"));
const cols = 4;
const tw = 320;
const th = 214;
const sheet = new PNG({ width: cols * tw, height: Math.ceil(results.length / cols) * th });
results.forEach((r, k) => {
  const src = PNG.sync.read(readFileSync(`${dir}${r.id}.png`));
  const ox = (k % cols) * tw;
  const oy = Math.floor(k / cols) * th;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const si = (Math.floor((y * src.height) / th) * src.width + Math.floor((x * src.width) / tw)) * 4;
      src.data.copy(sheet.data, ((oy + y) * sheet.width + ox + x) * 4, si, si + 4);
    }
  }
});
writeFileSync(`${dir}contact.png`, PNG.sync.write(sheet));
console.log(results.map((r, k) => `${k + 1}:${r.title} [${r.verdict}]`).join("  "));
