# Deployment & operations

## Recommended production topology

| Concern  | Recommendation                                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edge     | CDN + WAF (Cloudflare / CloudFront) terminating HTTPS; routes `/api/*` → API, `/media/*` → object storage, everything else → web. Cache `/_next/static` and `/media` for a year; respect `s-maxage` on pages. |
| Web      | ≥2 Next.js instances (`infra/docker/web.Dockerfile`, standalone output), 1 vCPU / 1 GB each to start.                                                                                                         |
| API      | ≥2 Express instances (`infra/docker/api.Dockerfile`), 1 vCPU / 512 MB each; stateless.                                                                                                                        |
| Worker   | 1–2 instances of the same image with `node dist/worker.js`; ~1 vCPU per 2 concurrent image jobs (`MEDIA_WORKER_CONCURRENCY`).                                                                                 |
| Database | MongoDB Atlas (M10+ for production; replica set, backups, monitoring). `MONGODB_MAX_POOL_SIZE` × API instances must stay below the cluster's connection limit.                                                |
| Redis    | Managed Redis (ElastiCache / Upstash / Redis Cloud) with `noeviction` (queues must not lose jobs).                                                                                                            |
| Files    | S3 / Cloudflare R2 / DigitalOcean Spaces (`STORAGE_DRIVER=s3`) — local storage is single-host only.                                                                                                           |
| Secrets  | Platform secret manager; never in images or the repository.                                                                                                                                                   |

## Environment

- API: `apps/api/.env.example` (validated at startup — the process exits with a clear message on
  invalid or missing values).
- Web: `apps/web/.env.example`. `API_INTERNAL_URL` is read at runtime, for server-side fetches and
  by `proxy.ts`, which forwards browser `/api/v1` and `/media` requests (unless a CDN/LB routes
  them to the API directly).
- Compose: `.env.example`.

Important production values: `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY` = number
of proxies in front of the API (e.g. `2` for CDN + LB), `PUBLIC_WEB_URL`, `MEDIA_PUBLIC_BASE_URL`
(CDN), `REDIS_URL` + `JOBS_DRIVER=bullmq`, `INTERNAL_API_TOKEN` (same value in web and API),
`REVALIDATE_SECRET` (same value), `WHATSAPP_BUSINESS_NUMBER` (or set it in Admin → Settings).

The web tier must sit behind a proxy that sets `X-Forwarded-For` (CDN/LB/nginx) so the API's
per-visitor rate limits see real client addresses.

## Separate deployments on Vercel (web and API as two projects)

The web app and the API are two independent Vercel projects from the same repository. Browsers
only talk to the web app: it forwards `/api/v1/*` and `/media/*` to the API (`apps/web/proxy.ts`),
so the admin session cookie stays first-party and no CORS is needed.

### API project

- **Root Directory** `apps/api`. Everything else comes from `apps/api/vercel.json`: framework
  "Other", build `npm run build` (tsup bundle), one function `api/index.js` that serves
  `dist/vercel.js`. Vercel never compiles the TypeScript sources itself.
- Environment (Production):

  | Variable                                                | Value                                                                              |
  | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
  | `NODE_ENV`                                              | `production`                                                                       |
  | `APP_SECRET`, `REVALIDATE_SECRET`, `INTERNAL_API_TOKEN` | long random values (the last two shared with web)                                  |
  | `MONGODB_URI`                                           | Atlas connection string                                                            |
  | `PUBLIC_WEB_URL`                                        | the web project's production URL, e.g. `https://shop.example.com`                  |
  | `WEB_REVALIDATE_URL`                                    | `https://shop.example.com/api/revalidate`                                          |
  | `TRUST_PROXY`                                           | `true` (Vercel sets `X-Forwarded-For` itself)                                      |
  | `STORAGE_DRIVER`                                        | `s3`, plus `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, keys (e.g. Cloudflare R2)      |
  | `MEDIA_PUBLIC_BASE_URL`                                 | public URL of the bucket's `public/` prefix (CDN or R2 public domain)              |
  | `MEDIA_MAX_UPLOAD_MB`                                   | `4` (Vercel Functions accept request bodies up to 4.5 MB)                          |
  | `REDIS_URL`                                             | recommended (e.g. Upstash `rediss://…`) so rate limits are shared by all instances |

- The API refuses to start on Vercel with `STORAGE_DRIVER=local` (read-only filesystem).
- Image processing runs inside the upload request (`JOBS_DRIVER=direct`, the default on Vercel),
  because a function may be frozen once its response is sent. No worker is needed.
- **Atlas → Network Access** must allow Vercel's addresses (they are not fixed: `0.0.0.0/0` with a
  strong database password, or Vercel's Secure Compute).
- Migrations and the first admin are one-off steps run from a machine with the production env:
  `npm run db:migrate -w @jmh/api` and `npm run admin:bootstrap -w @jmh/api`.
- Health check: `GET https://<api>/health` (process) and `/ready` (database).

### Web project

- **Root Directory** `apps/web`, framework Next.js (detected). The build script forces
  `NODE_ENV=production`; a `NODE_ENV=development` variable on the project would otherwise break
  `next build` ("Cannot read properties of null (reading 'useContext')" on `/_global-error`).
- Environment: `API_INTERNAL_URL` = the API's production URL, `NEXT_PUBLIC_SITE_URL` = the web URL,
  `REVALIDATE_SECRET` and `INTERNAL_API_TOKEN` (same values as the API). Do not copy the API's
  other variables here.
- `INTERNAL_API_TOKEN` is required in this setup: with it the proxy forwards each visitor's address
  (`X-Client-IP`), and the API rate-limits per visitor instead of treating all traffic as coming
  from the web project. The API only trusts that header when the token matches.

### Things to know

- **Deployment Protection**: Vercel protects preview deployments by default. Point the web
  project's `API_INTERNAL_URL` at the API's _production_ domain (or configure a protection bypass),
  otherwise the web server gets Vercel's login page instead of JSON.
- Admin sign-in and checkout check the browser's `Origin` against `PUBLIC_WEB_URL`; use the
  production web domain (add preview domains to `CORS_ORIGINS` if you test admin on previews).
- Deploy the API first, then set `API_INTERNAL_URL` on the web project and deploy it, then run the
  warm-up revalidation from the release procedure.
- Check the API build locally without deploying: `cd apps/api && npx vercel build`.

## Release procedure

1. Build images (CI): `docker build -f infra/docker/api.Dockerfile -t …/jmh-api:$SHA .` and the web
   image with `--build-arg NEXT_PUBLIC_SITE_URL=https://… --build-arg API_INTERNAL_URL=http://api:4000`.
2. Run checks in CI: `npm ci && npm run typecheck && npm run lint && npm test && npm run build`.
3. **Migrate** before rolling out: `node dist/migrate.js` (one-off job). Migrations are additive and
   forward-only; they never drop data. A lock prevents concurrent runs.
4. Roll out API/worker, then web, with rolling updates. Readiness: `GET /ready` (API), any page
   (web). The API drains connections on `SIGTERM` (25 s), the worker finishes active jobs.
5. **Warm the storefront** once the new web instances are healthy: `POST /api/revalidate` with
   header `x-revalidate-secret` and body `{"tags":["catalog","settings","home","promotions"]}`.
   Images built without API access contain placeholder ISR pages; this makes the first visitors
   get fresh pages instead of waiting for the 60 s revalidation window.
6. First deployment only: `node dist/bootstrap-admin.js` with the bootstrap variables, then remove
   the password (see [SECURITY.md](SECURITY.md)).

Single host: `cp .env.example .env`, fill it in, `docker compose up -d --build`, then
`docker compose run --rm api node dist/bootstrap-admin.js`. The site is on `http://localhost:8080`.

## Rollback

- Images are immutable and tagged by commit: redeploy the previous tag.
- Because migrations are additive, the previous release keeps working against the newer schema.
  If a migration ever needs to be reversed, write a new forward migration — never edit an applied one.
- Media and orders are append-only from the application's perspective; no rollback step needed.
- Storefront cache: after a rollback, `POST /api/revalidate` (with the secret) for tags
  `catalog, settings, home, promotions`, and purge the CDN if pages were cached with new markup.

## Backups & recovery

- **MongoDB**: Atlas continuous backup with point-in-time restore (recommended), or scheduled
  `mongodump --uri "$MONGODB_URI" --gzip --archive=…` to versioned, encrypted object storage.
  Test a restore into a staging cluster at least quarterly.
- **Media**: enable bucket versioning and cross-region replication (or periodic sync). Media keys
  are immutable, so incremental copies are cheap.
- **Redis** holds only queues, rate-limit counters and cache. Losing it delays image jobs (the
  stuck-asset sweep re-queues them) but loses no business data.
- Recovery order: database → media → deploy images → migrate → revalidate caches.

## Monitoring

- **Logs**: JSON to stdout (pino) with request ids (`X-Request-Id`); ship to your log platform.
  Slow MongoDB commands (≥250 ms) are logged with their duration.
- **Metrics**: `GET /metrics` (Bearer `METRICS_TOKEN`) exposes HTTP latency histograms by route,
  request counts by status class, MongoDB command latency, event-loop delay p50/p99/max, heap/RSS,
  CPU and job outcomes. Scrape with Prometheus/Grafana Agent.
- **Errors**: `registerErrorReporter()` in `apps/api/src/lib/error-reporter.ts` is the hook for
  Sentry or similar (see the comment there). The web app can add `@sentry/nextjs` the same way.
- **Alerts** (suggested): 5xx rate > 1 % for 5 min; p95 latency > 1 s; event-loop p99 > 200 ms;
  `/ready` failing; failed jobs > 0 for 15 min; Atlas connections > 80 %; disk/storage growth.

## Capacity notes

Catalogue pages are served from CDN/ISR and the Next.js data cache, so the database mainly sees
cache refreshes, cart quotes and checkouts. Order creation is the heaviest path (one transaction,
~6–10 writes). Size the cluster for expected **orders per second**, not visitors. See
[LOAD-TESTING.md](LOAD-TESTING.md) for how to measure and the results obtained so far.
