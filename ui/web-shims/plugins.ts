// Web stand-ins for the Tauri plugins the UI imports: dialog, opener,
// process and updater. Aliased per module in vite.config.ts.

// @tauri-apps/plugin-dialog
export async function ask(message: string, _opts?: unknown): Promise<boolean> {
  return window.confirm(message);
}
export async function confirm(message: string, _opts?: unknown): Promise<boolean> {
  return window.confirm(message);
}
export async function message(msg: string, _opts?: unknown): Promise<void> {
  window.alert(msg);
}
// Folder pickers only exist in the desktop setup wizard; the server knows
// where the collection is.
export async function open(_opts?: unknown): Promise<null> {
  return null;
}

// @tauri-apps/plugin-opener
export async function openUrl(url: string): Promise<void> {
  window.open(url, "_blank", "noopener");
}
export async function openPath(_path: string): Promise<void> {}

// @tauri-apps/plugin-process
export async function relaunch(): Promise<void> {
  location.reload();
}
export async function exit(_code?: number): Promise<void> {}

// @tauri-apps/plugin-updater: the server is updated by redeploying it.
export type Update = never;
export async function check(): Promise<null> {
  return null;
}
