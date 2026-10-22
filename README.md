# Jigar Matka House — e-commerce platform

Storefront, admin panel and API for **Jigar Matka House**, a shop for clay matkas, earthen water
pots, terracotta cookware, planters, festive pottery and other household products.

| Part                                | Tech                                                            | Path                           |
| ----------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| Storefront + admin UI               | Next.js 16 (App Router, RSC), React 19, Tailwind CSS 4, Motion  | `apps/web`                     |
| REST API + background worker        | Node.js, Express 5, TypeScript, Mongoose 9, Sharp, BullMQ       | `apps/api`                     |
| Shared contracts and business rules | TypeScript + Zod (pricing, permissions, order states, WhatsApp) | `packages/shared`              |
| Infrastructure                      | Docker, docker compose, nginx                                   | `infra/`, `docker-compose.yml` |
| Load tests                          | k6                                                              | `loadtest/`                    |
| Demo renders                        | Zero-dependency pottery renderer                                | `tools/pottery-renderer/`      |

Documentation: [architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [security](docs/SECURITY.md) ·
[media pipeline](docs/MEDIA-PIPELINE.md) · [deployment & operations](docs/DEPLOYMENT.md) ·
[load testing](docs/LOAD-TESTING.md)

## What it does

- **Storefront** — cinematic homepage (CSS hero reveal, scroll-scrubbed turntable, collection
  reveal, close-ups, category transitions), catalogue with search/filter/sort/pagination,
  product pages with variants, cart, checkout, order confirmation, order tracking, policies,
  SEO (metadata, canonical URLs, sitemap, robots, Product/Breadcrumb/Store JSON-LD).
- **Checkout** — the server re-prices every line from the database, applies at most one promotion,
  reserves stock in a MongoDB transaction (never oversells), supports Idempotency-Key retries,
  and builds the official `wa.me` link from the **saved** order. Opening WhatsApp never confirms
  an order; staff move orders through explicit statuses.
- **Admin** (`/admin`) — dashboard, products (crop/upload/WebP pipeline, variants, bulk actions,
  duplicate, archive), categories, image library, orders (status history, notes, cancellation
  with restock, WhatsApp contact, print), customers, inventory with movement log, promotions,
  homepage content, store settings, admin users & roles, audit log, account & sessions.
- **Security** — Argon2id passwords, hashed server-side sessions, CSRF tokens + origin checks,
  role-based permissions enforced by the API, rate limits, Helmet/CSP, audit trail.

## Quick start (development)

Requirements: Node.js 22.12+ (24 recommended), MongoDB 7+ **as a replica set** (transactions),
optionally Docker for Redis.

```bash
npm install
npm run dev:db                     # local MongoDB replica set on :27018 (+ Redis on :6380 if Docker is available)
cp apps/api/.env.example apps/api/.env          # set APP_SECRET; MONGODB_URI may point at Atlas
cp apps/web/.env.example apps/web/.env.local    # REVALIDATE_SECRET must match the API's
npm run admin:bootstrap            # needs BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD in apps/api/.env
npm run seed:demo                  # optional: illustrative demo catalogue (refuses to run in production)
npm run dev                        # API :4000, worker (when REDIS_URL is set), web :3000
```

Open <http://localhost:3000> and <http://localhost:3000/admin>. The first sign-in forces a
password change; then remove `BOOTSTRAP_ADMIN_PASSWORD` from the env file.

Set the shop's real details (WhatsApp number, phone, address, hours, delivery charges, policies)
in **Admin → Store settings**. Nothing is invented: the footer, structured data and checkout show
only what is configured, and delivery stays disabled (pickup only) until charges are set.

### Demo content

`npm run seed:demo` loads **sample** products, prices and stock with procedurally rendered
images (`tools/pottery-renderer`). They are placeholders, not photographs of real stock. Replace
them with real products and photos through the admin panel; `npm run seed:demo -- --reset-catalog`
removes only the demo products and categories.

## Quality gates

```bash
npm run typecheck        # all workspaces
npm run lint
npm test                 # shared unit tests + API integration tests (in-memory MongoDB replica set)
npm run build            # API bundle + Next.js production build
# End-to-end (isolated database jmh_e2e; never the dev/prod DB):
scripts/e2e-stack.sh prepare && scripts/e2e-stack.sh api &   # API :4100
scripts/e2e-stack.sh web &                                    # production build on :3100
E2E_BASE_URL=http://localhost:3100 npm run test:e2e
```

## Repository layout

```
apps/api       Express API (src/modules/*), worker, migrations, scripts, integration tests, seed
apps/web       Next.js app: app/(store) storefront, app/admin admin panel, components, e2e tests
packages/shared  Zod schemas, DTO types, pricing engine, order state machine, RBAC, WhatsApp
infra          Dockerfiles and nginx edge config
loadtest       k6 scenarios and results
scripts        dev services, E2E stack, brand/story asset builds
tools          pottery renderer (demo imagery)
```
