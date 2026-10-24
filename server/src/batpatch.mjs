// Rewrites for eXo launcher batch files, applied when a bundle is built.
//
// js-dos 8.4.1 hangs (plain DOSBox) or traps with WASM `unreachable`
// (DOSBox-X) when a batch `IF` runs a program directly, e.g.
// `IF %CHEAT%==N wc` (Wing Commander). `IF ... GOTO` works, so such lines
// become a GOTO around a label pair, which behaves the same:
//   IF %CHEAT%==N GOTO nxw1
//   GOTO nxw1e
//   :nxw1
//   wc
//   :nxw1e
// Labels stay within 8 characters, the part DOS compares.
//
// Launchers that mount their own CDs (Command & Conquer's campaign menu:
// `imgmount d ".\eXoDOS\comcon\cd\CD-1.iso" ...`) use eXo's host layout,
// which doesn't exist in a bundle; the failed mount is hidden by the next
// `cls` and the game then can't find its CD. Those paths get the same
// rewrite as the autoexec's (translate.mjs).
//
// `exit` (also as an IF's command) runs the quit program instead, so the
// player can still save the game's files (translate.mjs).

import { rewriteAutoexecLine } from "./translate.mjs";

// Bump when a rewrite changes, so cached bundles are rebuilt.
export const BATPATCH_VERSION = 9;

const IF_LINE = /^(\s*)(@?)if\s+(not\s+)?(errorlevel\s*=?\s*\d+|exist\s+(?:"[^"]*"|\S+)|(?:"[^"]*"|[^\s=]+)?==(?:"[^"]*"|\S+))\s+(\S.*)$/i;

// eXo switches MIDI with `CONFIG -set "mididevice=..."`; js-dos's DOSBox-X
// build traps on that too. The translated config already picks the device.
const MIDI_SWITCH = /^(\s*@?)(config\s+-set\s+"?mididevice=[^"\r\n]*"?)/i;

// js-dos 8.4.1 has no MIDI synth in either DOSBox build (no munt, no
// FluidSynth; only an OSS output that goes nowhere), so a launcher choice
// "w/ MT-32" or "w/ Sound Canvas" starts the game without music. Say so in
// the menu, so players pick the Sound Blaster / AdLib entry instead.
const MIDI_CHOICE = /^(\s*@?echo\b.*\bpress\b.*\b(?:w\/|with)\s*(?:mt-?32|sound ?canvas|general midi|gm|roland)\b.*?)\s*$/i;
const NO_MUSIC = " (no music)";

/**
 * @param {string} text  batch file contents (latin1)
 * @param {{backend: string}} opts
 * @returns {string|null} patched text, or null when nothing changed
 */
export function patchBatch(text, { backend }) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  let n = 0;
  let changed = false;
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (backend === "dosboxX" && MIDI_SWITCH.test(line)) {
      out.push(line.replace(MIDI_SWITCH, "$1REM exodiumweb: $2"));
      changed = true;
      continue;
    }
    if (MIDI_CHOICE.test(line) && !line.includes(NO_MUSIC)) {
      out.push(line.replace(MIDI_CHOICE, `$1${NO_MUSIC}`));
      changed = true;
      continue;
    }
    const mounted = rewriteAutoexecLine(line);
    if (mounted !== line) {
      out.push(mounted);
      changed = true;
      continue;
    }
    const m = line.match(IF_LINE);
    if (!m || /^(goto|if)\b/i.test(m[5])) {
      out.push(line);
      continue;
    }
    const [, ind, at, not = "", cond, cmd] = m;
    const label = `nxw${++n}`;
    out.push(`${ind}${at}if ${not}${cond} goto ${label}`, `${ind}${at}goto ${label}e`, `:${label}`, rewriteAutoexecLine(`${ind}${cmd}`), `:${label}e`);
    changed = true;
  }
  return changed ? out.join(eol) : null;
}
