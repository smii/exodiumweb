// Watchdog self-test for run-detached.sh: grows by 50 MB steps up to a hard
// cap (default 800 MB) and then idles, so it can never threaten the pod even
// if the watchdog is broken. Usage: node memhog.mjs [capMB]
const cap = Number(process.argv[2] ?? 800);
const held = [];
const t = setInterval(() => {
  held.push(Buffer.alloc(50e6, 1));
  console.log(`holding ${held.length * 50} MB`);
  if (held.length * 50 >= cap) clearInterval(t);
}, 300);
setTimeout(() => {}, 60_000);
