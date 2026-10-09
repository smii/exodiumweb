// Web stand-in for @tauri-apps/api/core. Every Tauri command becomes
// POST /api/invoke/<command> with the same JSON arguments; the server answers
// with the command's return value, or an error string (Tauri rejects with a
// string too, so the UI's catch blocks keep working unchanged).

import { emit } from "./event";
import "./web.css";

// Entry point to the downloaded-games page (server/public/downloads.html).
function addDownloadsLink() {
  if (document.getElementById("notexoweb-downloads")) return;
  const a = document.createElement("a");
  a.id = "notexoweb-downloads";
  a.href = "/downloads.html";
  a.textContent = "⤓ Downloads";
  a.title = "Large games stored in this browser";
  document.body.append(a);
}
if (document.body) addDownloadsLink();
else addEventListener("DOMContentLoaded", addDownloadsLink);

// The desktop app spawns DOSBox on launch_game and emits `game-exited` when
// it quits. Here the server records the launch and the game runs in an
// overlay <iframe> (server/public/player.html); closing it emits the event.
//
// The overlay gets its own history entry, so the browser's Back button closes
// the game (the player saves first) instead of leaving the app -- which went
// back to the Authelia login page that preceded it.
function openPlayer(id: number) {
  document.getElementById("notexoweb-player")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "notexoweb-player";
  frame.src = `/player.html?id=${id}`;
  frame.allow = "fullscreen; autoplay; gamepad; clipboard-write";
  frame.setAttribute("allowfullscreen", "");
  frame.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483647;background:#000";
  history.pushState({ notexowebPlayer: id }, "");
  let poppedByBack = false;
  const onPop = () => {
    // Back pressed while playing: ask the player to save and close.
    poppedByBack = true;
    frame.contentWindow?.postMessage({ type: "notexoweb:close" }, location.origin);
  };
  const onMessage = (e: MessageEvent) => {
    if (e.origin !== location.origin || e.data?.type !== "notexoweb:player-closed" || e.data.id !== id) return;
    window.removeEventListener("message", onMessage);
    window.removeEventListener("popstate", onPop);
    frame.remove();
    // Closed with its own button (or the game exited): drop our history entry.
    if (!poppedByBack && history.state?.notexowebPlayer === id) history.back();
    void emit("game-exited", { id });
  };
  window.addEventListener("message", onMessage);
  window.addEventListener("popstate", onPop);
  document.body.append(frame);
  frame.focus();
}

export async function invoke<T = unknown>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (cmd === "launch_game") {
    const result = await call<T>(cmd, args);
    openPlayer(Number(args.id));
    return result;
  }
  return call<T>(cmd, args);
}

async function call<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/invoke/${encodeURIComponent(cmd)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw typeof body?.error === "string" ? body.error : `${cmd} failed (${res.status})`;
  }
  return body as T;
}

// Tauri's asset protocol turns a local file path into a URL; here the server
// serves the (whitelisted) path instead.
export function convertFileSrc(filePath: string, _protocol = "asset"): string {
  return `/asset?path=${encodeURIComponent(filePath)}`;
}

export function isTauri(): boolean {
  return false;
}
