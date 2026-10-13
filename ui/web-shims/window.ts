// Web stand-in for @tauri-apps/api/window. The browser owns the window, so
// minimise/close do nothing and "maximise" means the Fullscreen API.

const win = {
  async onResized(cb: () => void) {
    window.addEventListener("resize", cb);
    return () => window.removeEventListener("resize", cb);
  },
  async isMaximized() {
    return document.fullscreenElement != null;
  },
  async minimize() {},
  async toggleMaximize() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen().catch(() => {});
  },
  async close() {},
  async setTitle(title: string) {
    document.title = title;
  },
};

export function getCurrentWindow() {
  return win;
}
