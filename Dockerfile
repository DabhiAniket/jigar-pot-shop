# Storefront + admin (Next.js standalone output).
# docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
#   --build-arg NEXT_PUBLIC_SITE_URL=https://www.example.com -t jmh-web .
FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=http://api:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --no-audit --no-fund
COPY . .
# Pages that need the API at build time fall back to placeholders and regenerate at runtime.
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/robots.txt || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
