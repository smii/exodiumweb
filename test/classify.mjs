// Classify a player screenshot by the emulator area only (skips the js-dos
// sidebar on the left and the Close button on top, which add colours of
// their own). BLANK = nothing drawn, TEXT = few colours, GRAPHICS = many.
import { PNG } from "pngjs";

export function classify(buf) {
  const { width: w, height: h, data } = PNG.sync.read(buf);
  const colours = new Set();
  let lit = 0;
  let n = 0;
  for (let y = 50; y < h - 10; y += 3) {
    for (let x = 20; x < w - 10; x += 3) {
      const i = (y * w + x) * 4;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      colours.add((r << 16) | (g << 8) | b);
      if (r + g + b > 60) lit++;
      n++;
    }
  }
  const litPct = Math.round((1000 * lit) / n) / 10;
  // A lone DOS prompt line ("Press any key") lights only ~0.2% of the area.
  const verdict = litPct < 0.05 ? "BLANK" : colours.size <= 18 ? "TEXT" : "GRAPHICS";
  return { verdict, colours: colours.size, litPct };
}
