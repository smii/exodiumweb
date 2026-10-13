// Web stand-in for @tauri-apps/api/event: one shared Server-Sent Events stream
// (/api/events) fans events out to listen() callers by name.

export interface Event<T> {
  event: string;
  id: number;
  payload: T;
}
export type UnlistenFn = () => void;

type Handler = (e: Event<unknown>) => void;
const handlers = new Map<string, Set<Handler>>();
let source: EventSource | null = null;
let seq = 0;

function ensureSource() {
  if (source || typeof EventSource === "undefined") return;
  source = new EventSource("/api/events");
  source.onmessage = (msg) => {
    let data: { event: string; payload: unknown };
    try { data = JSON.parse(msg.data); } catch { return; }
    for (const h of handlers.get(data.event) ?? []) h({ event: data.event, id: ++seq, payload: data.payload });
  };
}

export async function listen<T>(event: string, handler: (e: Event<T>) => void): Promise<UnlistenFn> {
  ensureSource();
  const set = handlers.get(event) ?? new Set<Handler>();
  handlers.set(event, set);
  set.add(handler as Handler);
  return () => { set.delete(handler as Handler); };
}

export async function once<T>(event: string, handler: (e: Event<T>) => void): Promise<UnlistenFn> {
  const un = await listen<T>(event, (e) => { un(); handler(e); });
  return un;
}

// Local fan-out, used by the in-browser player to announce `game-exited`.
export async function emit(event: string, payload?: unknown): Promise<void> {
  for (const h of handlers.get(event) ?? []) h({ event, id: ++seq, payload });
}
