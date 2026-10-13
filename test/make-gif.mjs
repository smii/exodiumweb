// Turn a recorded .webm into an animated GIF that GitHub shows inline.
// Usage: node make-gif.mjs <in.webm> <out.gif> [fps=5] [width=640] [maxSeconds=60]
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const [input, output, fps = "5", width = "640", maxSecs = "60"] = process.argv.slice(2);
const FFMPEG = process.env.FFMPEG ?? join(process.env.HOME, ".cache/ms-playwright/ffmpeg-1011/ffmpeg-linux");

const dir = mkdtempSync(join(tmpdir(), "gif-"));
try {
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", input, "-t", maxSecs,
    // Playwright's ffmpeg is a minimal build: no fps filter, so -r sets the rate.
    "-vf", `scale=${width}:-2`, "-r", fps, join(dir, "f%05d.png")]);
  const frames = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
  const gif = GIFEncoder();
  const delay = Math.round(1000 / Number(fps));
  for (const f of frames) {
    const png = PNG.sync.read(readFileSync(join(dir, f)));
    const palette = quantize(png.data, 256);
    gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay });
  }
  gif.finish();
  writeFileSync(output, gif.bytes());
  console.log(`${output}: ${frames.length} frames, ${(gif.bytes().length / 1024 / 1024).toFixed(1)} MiB`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
