# Storefront + admin (Next.js standalone output).
# API_INTERNAL_URL is baked into the rewrite rules at build time.
# docker build -f infra/docker/web.Dockerfile --build-arg API_INTERNAL_URL=http://api:4000 \
#   --build-arg NEXT_PUBLIC_SITE_URL=https://www.example.com -t jmh-web .
FROM node:22-alpine AS build
WORKDIR /app
ARG API_INTERNAL_URL=http://api:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:8080
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --workspace @jmh/web --include-workspace-root --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/web apps/web
# Pages that need the API at build time fall back to placeholders and regenerate at runtime.
RUN npm run build -w @jmh/web

FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/robots.txt || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
