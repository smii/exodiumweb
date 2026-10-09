// Hover info panel for the library grid (browser-only addition; Exodium's
// own components are unchanged). Resting the pointer on a game card slides a
// panel out beside it with the description, credits, rating and a few
// "more like this" picks from the same series or genre. Cards carry
// data-game-id, so the panel looks the game up itself.
import { invoke } from "./core";

interface Game {
  id: number;
  title: string;
  year: number | null;
  developer: string | null;
  publisher: string | null;
  genre: string | null;
  series: string | null;
  description: string | null;
  max_players: number | null;
  rating: number | null;
  play_mode: string | null;
  thumbnail_key: string | null;
}

const DELAY_MS = 380;
const cache = new Map<number, Promise<{ game: Game; similar: Game[] }>>();
let panel: HTMLDivElement | null = null;
let timer: number | undefined;
let current: HTMLElement | null = null;

function load(id: number) {
  if (!cache.has(id)) {
    cache.set(id, (async () => {
      const game = await invoke<Game>("get_game", { id });
      const genre = (game.genre ?? "").split(";")[0].trim();
      // Same series first (sequels), then same main genre.
      const pick = async (query: string, filter: Record<string, unknown>) => {
        const r = await invoke<{ games?: Game[] } | Game[]>("get_games", { page: 1, perPage: 12, query, ...filter });
        return (Array.isArray(r) ? r : r.games ?? []).filter((g) => g.id !== id);
      };
      const series = game.series ? await pick(game.series, {}) : [];
      const sameGenre = genre ? await pick("", { genre, sortBy: "rating" }) : [];
      const seen = new Set<number>();
      const similar = [...series, ...sameGenre].filter((g) => !seen.has(g.id) && seen.add(g.id)).slice(0, 4);
      return { game, similar };
    })().catch((e) => { cache.delete(id); throw e; }));
  }
  return cache.get(id)!;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function stars(rating: number | null) {
  if (rating == null || rating <= 0) return "";
  const r = Math.max(0, Math.min(5, rating));
  return `<span class="exw-stars" title="Community rating ${r.toFixed(1)} / 5">${"★".repeat(Math.round(r))}${"☆".repeat(5 - Math.round(r))}</span>`;
}

function render(card: HTMLElement, game: Game, similar: Game[]) {
  const cover = card.querySelector<HTMLImageElement>(".game-card-thumb")?.src;
  const credits = [game.developer, game.publisher && game.publisher !== game.developer ? game.publisher : null].filter(Boolean).join(" · ");
  const facts = [
    game.year,
    game.genre?.split(";").map((g) => g.trim()).join(", "),
    game.max_players && game.max_players > 1 ? `${game.max_players} players` : game.play_mode,
  ].filter(Boolean);
  const desc = (game.description ?? "").replace(/\r/g, "").split(/\n\s*\n/)[0];
  return `
    <div class="exw-hover-head">
      ${cover ? `<img class="exw-hover-cover" src="${esc(cover)}" alt="">` : ""}
      <div>
        <div class="exw-hover-title">${esc(game.title)}</div>
        ${credits ? `<div class="exw-hover-credits">${esc(credits)}</div>` : ""}
        <div class="exw-hover-facts">${facts.map((f) => `<span>${esc(String(f))}</span>`).join("")}</div>
        ${stars(game.rating)}
      </div>
    </div>
    ${desc ? `<p class="exw-hover-desc">${esc(desc)}</p>` : ""}
    ${similar.length ? `<div class="exw-hover-more"><div class="exw-hover-label">More like this</div>${similar.map((g) =>
      `<div class="exw-hover-similar"><span>${esc(g.title)}</span><em>${g.year ?? ""}</em></div>`).join("")}</div>` : ""}
    <div class="exw-hover-hint">Click the card for details · ▶ Play</div>`;
}

function place(card: HTMLElement) {
  if (!panel) return;
  const r = card.getBoundingClientRect();
  const w = panel.offsetWidth || 340;
  const h = panel.offsetHeight || 300;
  const right = r.right + 12 + w <= window.innerWidth;
  panel.classList.toggle("from-left", !right);
  panel.style.left = `${right ? r.right + 12 : Math.max(8, r.left - 12 - w)}px`;
  panel.style.top = `${Math.max(8, Math.min(r.top, window.innerHeight - h - 8))}px`;
}

function hide() {
  window.clearTimeout(timer);
  current = null;
  panel?.classList.remove("is-open");
}

async function show(card: HTMLElement) {
  const id = Number(card.dataset.gameId);
  if (!id) return;
  panel ??= Object.assign(document.createElement("div"), { className: "exw-hover", role: "tooltip" });
  if (!panel.isConnected) document.body.append(panel);
  try {
    const { game, similar } = await load(id);
    if (current !== card) return; // pointer moved on meanwhile
    panel.innerHTML = render(card, game, similar);
    place(card);
    panel.classList.add("is-open");
    // The cover may finish loading after the first measure.
    panel.querySelector("img")?.addEventListener("load", () => current === card && place(card), { once: true });
  } catch {
    hide();
  }
}

function enabled() {
  return localStorage.getItem("exodiumweb:hoverInfo") !== "off" && matchMedia("(hover: hover)").matches;
}

document.addEventListener("pointerover", (e) => {
  const card = (e.target as HTMLElement).closest?.<HTMLElement>(".game-card[data-game-id]");
  if (card === current) return;
  hide();
  if (!card || !enabled() || document.getElementById("exodiumweb-player")) return;
  current = card;
  timer = window.setTimeout(() => void show(card), DELAY_MS);
});
document.addEventListener("pointerdown", hide, true);
document.addEventListener("scroll", hide, true);
window.addEventListener("blur", hide);

