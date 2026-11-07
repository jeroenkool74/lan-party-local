# Build context: the openrct2/ directory (the tests also exercise plugins/lan-stats).
ARG NODE_IMAGE=node:24.22.2-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /src/dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY dashboard/ ./
COPY plugins/lan-stats/ /src/plugins/lan-stats/
RUN npm run typecheck && npm test && npm run build

FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    HTTP_PORT=8080 \
    INGEST_PORT=9000 \
    DB_PATH=/data/stats.sqlite \
    STATIC_DIR=/app/web/dist
WORKDIR /app
# The backend has no runtime npm dependencies (node:sqlite, node:http, TypeScript type stripping).
COPY --from=build /src/dashboard/package.json ./
COPY --from=build /src/dashboard/server ./server
COPY --from=build /src/dashboard/web/dist ./web/dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080 9000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.HTTP_PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/main.ts"]
