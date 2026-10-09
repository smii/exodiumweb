# exodiumweb: Exodium's UI + js-dos, served by a dependency-free Node server.
#
# Runtime mounts (nothing from the eXo collection is baked in):
#   /collection  eXoDOS folder (holds eXo/ and Content/), read-only
#   /mt32        MT32_CONTROL.ROM + MT32_PCM.ROM (optional), read-only
#   /state       per-user databases and saves (persistent)
#   /cache       built game bundles (disposable, can be large)
# The login proxy in front must set Remote-User (USER_HEADER to change it).

# ── UI: Exodium's SolidJS frontend with the web shims ─────────────────────
FROM node:22.20.0-bookworm-slim AS ui
WORKDIR /src/ui
COPY ui/package.json ui/pnpm-lock.yaml ./
RUN npx --yes pnpm@9 install --frozen-lockfile
COPY ui/ ./
RUN npx --yes pnpm@9 build

# ── Upstream data (Exodium catalogue + thumbnails) and js-dos ─────────────
FROM node:22.20.0-bookworm-slim AS data
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src/server
COPY server/package.json ./
COPY server/scripts/ scripts/
RUN bash scripts/fetch-upstream-data.sh v0.15.2 && npm run fetch-jsdos

# ── Runtime ───────────────────────────────────────────────────────────────
FROM node:22.20.0-bookworm-slim
ENV NODE_ENV=production \
    PORT=8080 \
    COLLECTION_ROOT=/collection \
    MT32_DIR=/mt32 \
    STATE_DIR=/state \
    CACHE_DIR=/cache \
    UI_DIST=/app/ui/dist
WORKDIR /app/server
COPY --from=ui /src/ui/dist /app/ui/dist
COPY --from=data /src/server/data data/
COPY --from=data /src/server/assets assets/
COPY --from=data /src/server/vendor vendor/
COPY server/package.json ./
COPY server/public public/
COPY server/src src/
# Build the eXoDOS-only catalogue now; data/ is read-only at runtime.
RUN node --disable-warning=ExperimentalWarning -e "import('./src/db.mjs').then((m) => m.ensureCatalog('data'))" \
 && mkdir -p /state /cache && chown node:node /state /cache
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.mjs"]
