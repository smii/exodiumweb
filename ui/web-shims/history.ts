// Browser Back/Forward inside the app. Exodium is a desktop app with no
// routes, so Back left the site even with a game's details open. The UI is
// kept unchanged (see UPSTREAM.md), so this watches it from the outside:
//
//  - switching tabs (Browse / My Library / Reading Room) adds a history entry;
//  - opening a layer (game details, gallery, manual, a dialog, an issue)
//    adds one per layer.
//
// Back closes the top layer the way Esc does, or returns to the previous tab.
// Closing a layer with its own ✕ drops the entry it added, so Back never
// lands on a layer that is already gone. The game player handles its own
// entry (core.ts).

type Snap = { tab: string | null; layers: number };
type Entry = Snap & { exw: number };

const LAYER = ".game-detail-panel, [role='dialog'], [role='alertdialog']";

function layerElements(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(LAYER)].filter((el) =>
    el.dataset.state !== "closed" && !el.hidden && el.getClientRects().length > 0);
}

function snap(): Snap {
  const tab = document.querySelector<HTMLElement>(".lib-tab.active")?.dataset.testid?.replace(/^tab-/, "") ?? null;
  return { tab, layers: layerElements().length };
}

let seq = 0;
let cur: Snap = { tab: null, layers: 0 };
let ignorePops = 0; // popstates caused by our own history.back()/go()
let tabClicked = false; // the next tab change comes from a click on a tab
let applying = false; // popstate is moving the UI; don't record what changes

const entry = (s: Snap): Entry => ({ ...s, exw: ++seq });

function record() {
  if (applying || document.getElementById("exodiumweb-player")) return;
  const next = snap();
  if (next.tab === null && cur.tab === null) return; // still starting up
  if (cur.tab === null) { // the library just rendered: label the starting entry
    history.replaceState(entry(next), "");
    cur = next;
    return;
  }
  if (next.layers > cur.layers) {
    for (let n = cur.layers + 1; n <= next.layers; n++) history.pushState(entry({ tab: next.tab, layers: n }), "");
  } else if (next.layers < cur.layers) {
    // Closed from inside the UI: drop the entries those layers added.
    const here = history.state as Entry | null;
    const own = here?.exw !== undefined ? here.layers - next.layers : 0;
    if (own > 0) { ignorePops++; history.go(-own); }
  } else if (next.tab !== cur.tab && next.tab !== null) {
    // Only a tab the user picked is a step back; the app also switches by
    // itself on start (to My Library when there are recent games).
    if (tabClicked) history.pushState(entry(next), "");
    else history.replaceState(entry(next), "");
  }
  tabClicked = false;
  cur = next;
}

const wait = () => new Promise((r) => setTimeout(r, 60));

/** Close the top layer the way the UI expects: Esc, or the panel's ✕. */
async function closeTop() {
  const before = layerElements().length;
  const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
  await wait();
  if (layerElements().length < before) return;
  document.querySelector<HTMLElement>(".game-detail-close")?.click();
  await wait();
}

addEventListener("popstate", async (e) => {
  if (ignorePops > 0) { ignorePops--; cur = snap(); return; }
  const want = e.state as (Entry & { exodiumwebPlayer?: number }) | null;
  if (want?.exodiumwebPlayer !== undefined || document.getElementById("exodiumweb-player")) return;
  if (want?.exw === undefined) return; // before the app: the browser is leaving
  applying = true;
  try {
    for (let i = 0; i < 8 && layerElements().length > want.layers; i++) await closeTop();
    if (want.tab && snap().tab !== want.tab) {
      document.querySelector<HTMLElement>(`[data-testid='tab-${want.tab}']`)?.click();
      await wait();
    }
  } finally {
    applying = false;
    cur = snap();
    // Forward to a layer that can't be reopened: keep history honest.
    if (cur.layers !== want.layers || cur.tab !== want.tab) history.replaceState(entry(cur), "");
  }
});

addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest?.(".lib-tab")) tabClicked = true;
}, true);

function start() {
  cur = snap();
  history.replaceState(entry(cur), "");
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; record(); });
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "data-state", "hidden"] });
}
if (document.body) start();
else addEventListener("DOMContentLoaded", start);
