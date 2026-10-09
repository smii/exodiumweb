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

// Bump when a rewrite changes, so cached bundles are rebuilt.
export const BATPATCH_VERSION = 2;

const IF_LINE = /^(\s*)(@?)if\s+(not\s+)?(errorlevel\s*=?\s*\d+|exist\s+(?:"[^"]*"|\S+)|(?:"[^"]*"|[^\s=]+)?==(?:"[^"]*"|\S+))\s+(\S.*)$/i;

// eXo switches MIDI with `CONFIG -set "mididevice=..."`; js-dos's DOSBox-X
// build traps on that too. The translated config already picks the device.
const MIDI_SWITCH = /^(\s*@?)(config\s+-set\s+"?mididevice=[^"\r\n]*"?)/i;

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
    const m = line.match(IF_LINE);
    if (!m || /^(goto|if)\b/i.test(m[5])) {
      out.push(line);
      continue;
    }
    const [, ind, at, not = "", cond, cmd] = m;
    const label = `nxw${++n}`;
    out.push(`${ind}${at}if ${not}${cond} goto ${label}`, `${ind}${at}goto ${label}e`, `:${label}`, `${ind}${cmd}`, `:${label}e`);
    changed = true;
  }
  return changed ? out.join(eol) : null;
}
