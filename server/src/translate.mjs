// Translate an eXoDOS dosbox.conf (written for DOSBox-ECE / DOSBox Staging on
// Windows) into a config js-dos 8 can run, and pick the js-dos backend.
//
// js-dos file system layout this assumes (built by the player page):
//   ./<shortcode>/...      the game zip, extracted as-is (its single top folder)
//   ./mt32/  ./mt32/rev0/  MT-32 ROMs (control + pcm), only when needed
// eXo runs DOSBox from its eXo/ folder, so every host path in a conf is
// `.\eXoDOS\<shortcode>...`; we strip `.\eXoDOS\` and flip backslashes.

const DROP_SECTIONS = new Set([
  "sdl", "render", "composite", "mouse", "fluidsynth", "reelmagic", "imfc",
  "innovation", "ethernet", "serial", "joystick",
]);

// Keys that only exist in Staging/ECE or describe the host window; js-dos owns
// output, scaling and input, so passing them on only produces warnings.
const DROP_KEYS = new Set([
  "priority", "mapperfile", "mcb_fault_strategy", "cpu_cycles_protected", "cpu_throttle",
  "sb_filter", "opl_filter", "pcspeaker_filter", "tandy_filter", "lpt_dac", "ps1audio",
  "prebuffer", "blocksize", "negotiate", "sbmixer", "timed", "autofire", "circularinput",
  "deadzone", "use_joy_calibration_hotkeys", "joy_x_calibration", "joy_y_calibration",
  "vmemsize", "voodoo", "voodoo_memsize", "voodoo_threads", "voodoo_bilinear_filtering",
  "voodoo_multithreading", "voodoo_perf", "voodoomem", "glide", "romdir", "soundfont",
]);

// The only sample rate js-dos's audio output plays correctly.
const AUDIO_RATE = 44100;
const SOUND_SECTIONS = new Set(["mixer", "sblaster", "gus", "speaker"]);

export function parseConf(text) {
  const sections = [];
  let cur = { name: "", lines: [] };
  sections.push(cur);
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const m = raw.match(/^\s*\[([^\]]+)\]\s*$/);
    if (m) {
      cur = { name: m[1].trim().toLowerCase(), lines: [] };
      sections.push(cur);
    } else {
      cur.lines.push(raw);
    }
  }
  return sections;
}

function kv(line) {
  if (/^\s*[#;]/.test(line)) return null;
  const m = line.match(/^\s*([A-Za-z0-9_.]+)\s*=\s*(.*?)\s*$/);
  return m ? { key: m[1].toLowerCase(), value: m[2] } : null;
}

// `.\eXoDOS\Game\cd\x.cue` -> `./Game/cd/x.cue`; `.\eXoDOS\` -> `.`
export function hostPath(p) {
  let s = p.replace(/^"|"$/g, "").replace(/\\/g, "/");
  s = s.replace(/^\.\/eXoDOS\/?/i, "./").replace(/^\.\/mt32/i, "./mt32");
  if (s === "./") s = ".";
  s = s.replace(/\/+$/, "") || ".";
  return /\s/.test(s) ? `"${s}"` : s;
}

// mount/imgmount: every argument that looks like a host path gets rewritten.
function rewriteAutoexecLine(line) {
  const m = line.match(/^(\s*@?)(mount|imgmount)(\s+)(.*)$/i);
  if (!m) return line;
  const args = m[4].match(/"[^"]*"|\S+/g) ?? [];
  const out = args.map((a) => (/^"?\.\\|\\eXoDOS\\/i.test(a) ? hostPath(a) : a));
  return `${m[1]}${m[2]}${m[3]}${out.join(" ")}`;
}

export function analyse(text) {
  const t = text.replace(/\r/g, "");
  const get = (k) => {
    const m = t.match(new RegExp(`^\\s*${k}\\s*=\\s*(\\S+)`, "im"));
    return m ? m[1].toLowerCase() : null;
  };
  return {
    // eXo leaves voodoo=true as a template default; only the 30 real 3dfx
    // titles also turn bilinear filtering on.
    voodoo: get("voodoo_bilinear_filtering") === "true" || ["opengl", "software"].includes(get("voodoo") ?? ""),
    mt32: get("mididevice") === "mt32",
    ipx: get("ipx") === "true",
    gus: get("gus") === "true",
    cd: /^\s*@?imgmount\s+\S+\s+\S+.*-t\s+(cdrom|iso)/im.test(t),
    boot: /^\s*@?boot\b/im.test(t),
    machine: get("machine"),
    cycles: get("cpu_cycles") ?? get("cycles"),
  };
}

// DOSBox-X only where nothing else will do. js-dos 8.4.1's DOSBox-X build
// traps (WASM `unreachable`) on batch commands eXo launchers use everywhere
// (`IF %VAR%==x prog`, `CONFIG -set ...`; found on Wing Commander), so MT-32
// games run on plain DOSBox with Sound Blaster/AdLib music instead. Neither
// build has a MIDI synth anyway (no munt, no FluidSynth; checked 2026-10-09).
export function chooseBackend(info, variant) {
  if (info.voodoo) return "dosboxX";
  if (variant === "x" || variant === "x2") return "dosboxX";
  return "dosbox";
}

/**
 * @param {string} text  original eXo dosbox.conf
 * @param {{variant?: string, backend?: "dosbox"|"dosboxX"}} opts
 * @returns {{backend: string, conf: string, info: object, needs: {mt32: boolean}}}
 */
const CYCLES_CAP = 100000;

export function translate(text, opts = {}) {
  const info = analyse(text);
  const backend = opts.backend ?? chooseBackend(info, opts.variant);
  const out = [];
  let haveMidi = false;

  for (const sec of parseConf(text)) {
    if (sec.name === "") continue; // preamble comments
    if (DROP_SECTIONS.has(sec.name) || sec.name === "mt32" || sec.name === "voodoo") continue;
    if (sec.name === "autoexec") continue; // written last
    const lines = [];
    for (const line of sec.lines) {
      const p = kv(line);
      if (!p) continue;
      let { key, value } = p;
      if (DROP_KEYS.has(key) || key.endsWith(".soundfont")) continue;
      // Any other setting pointing at a Windows host path (fluidsynth fonts,
      // capture dirs, ...) can't resolve inside js-dos.
      if (/^\.?\\|^[a-z]:\\/i.test(value) && !(sec.name === "gus" && key === "ultradir")) continue;
      // eXo's Shadow Warrior conf misspells it; DOSBox-X then falls back to svga_s3.
      if (sec.name === "dosbox" && key === "machine" && value.toLowerCase() === "vesa_noflb") value = "vesa_nolfb";
      // svga_s3 shows black in js-dos's DOSBox (Quake); vesa_nolfb renders.
      if (sec.name === "dosbox" && key === "machine" && backend !== "dosboxX" && value.toLowerCase() === "svga_s3") value = "vesa_nolfb";
      if (sec.name === "dosbox" && key === "memsize" && Number(value) > 63) value = "63";
      if (key === "cpu_cycles") key = "cycles"; // Staging 0.82 spelling
      if (key === "mt32.romdir" || key === "midiconfig") continue; // re-added below
      // Fixed cycles tuned for native DOSBox (200000+) outrun the WASM core:
      // the emulation lags and the audio queue starves (crackle). Cap them.
      if (key === "cycles" && /^\d+$/.test(value) && Number(value) > CYCLES_CAP) value = String(CYCLES_CAP);
      if (key === "cycles" && /^\d+$/.test(value) === false && !/^(auto|max|fixed)/i.test(value)) continue;
      // js-dos plays through an AudioWorklet fixed at 44100 Hz (secure pages)
      // and doesn't resample: a 48000/49716 Hz mixer overfills its queue, so
      // sound came out low-pitched and choppy (dropped chunks).
      if (SOUND_SECTIONS.has(sec.name) && /rate$/.test(key) && /^\d+$/.test(value)) value = String(AUDIO_RATE);
      if (sec.name === "midi" && key === "mididevice") {
        haveMidi = true;
        if (value.toLowerCase() === "mt32" && backend !== "dosboxX") value = "default";
        if (["auto", "fluidsynth", "soundcanvas"].includes(value.toLowerCase())) value = "default";
      }
      lines.push(`${key}=${value}`);
    }
    if (sec.name === "mixer" && !lines.some((l) => l.startsWith("rate="))) lines.push(`rate=${AUDIO_RATE}`);
    if (sec.name === "mixer") {
      for (const [k, v] of [["blocksize", "2048"], ["prebuffer", "100"]]) {
        const i = lines.findIndex((l) => l.startsWith(k + "="));
        if (i >= 0) lines[i] = `${k}=${v}`; else lines.push(`${k}=${v}`);
      }
    }
    if (sec.name === "midi" && info.mt32 && backend === "dosboxX") {
      lines.push("mt32.romdir=./mt32/rev0");
    }
    if (lines.length) out.push(`[${sec.name}]`, ...lines, "");
  }
  if (!parseConf(text).some((sec) => sec.name === "mixer")) out.push("[mixer]", `rate=${AUDIO_RATE}`, "");
  if (info.mt32 && backend === "dosboxX" && !haveMidi) {
    out.push("[midi]", "mididevice=mt32", "mt32.romdir=./mt32/rev0", "");
  }
  if (info.voodoo && backend === "dosboxX") {
    // js-dos renders DOSBox-X's Voodoo through WebGL (needs renderBackend webgl).
    out.push("[voodoo]", "voodoo_card=opengl", "glide=false", "");
  }

  const auto = parseConf(text).find((s) => s.name === "autoexec");
  out.push("[autoexec]");
  for (const line of auto?.lines ?? []) {
    if (!line.trim()) continue;
    out.push(rewriteAutoexecLine(line));
  }
  return { backend, conf: out.join("\n") + "\n", info, needs: { mt32: info.mt32 && backend === "dosboxX" } };
}
