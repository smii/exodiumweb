# Upstream

Everything in `ui/` except `web-shims/` and the alias block in
`vite.config.ts` is copied unchanged from
[Exodium](https://github.com/tvollstaedt/exodium) **v0.15.2**
(copied 2026-10-07), MIT licensed — see `UPSTREAM-LICENSE`.

Keep those files identical to upstream so a newer Exodium frontend can be
dropped in: copy upstream `src/`, `public/`, `index.html`, `package.json`,
`tsconfig*.json`, `scripts/`, then re-apply the alias block.

`web-shims/` replaces the seven Tauri modules the UI imports
(`@tauri-apps/api/{core,event,window}`, `plugin-{dialog,opener,process,updater}`)
with browser versions; `invoke()` becomes `POST /api/invoke/<command>` on the
exodiumweb server.
