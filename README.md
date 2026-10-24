# Jigar Matka House — storefront & admin

Next.js storefront and admin panel for **Jigar Matka House**, a shop for clay matkas, earthen
water pots, terracotta cookware, planters, festive pottery and other household products.

The REST API (Express, MongoDB, image pipeline) lives in a separate repository,
[`jigar-pot-shop-backend`](https://github.com/DabhiAniket/jigar-pot-shop-backend).

| Part                               | Tech                                                           | Path                              |
| ---------------------------------- | -------------------------------------------------------------- | --------------------------------- |
| Storefront + admin UI              | Next.js 16 (App Router, RSC), React 19, Tailwind CSS 4, Motion | `app/`, `components/`, `lib/`     |
| Backend URL + request forwarding   | One config module and the Next.js proxy                        | `lib/api/base-url.ts`, `proxy.ts` |
| Shared contracts (copy)            | TypeScript + Zod, exported from the backend                    | `shared/` (alias `@jmh/shared`)   |
| End-to-end tests                   | Playwright                                                     | `e2e/`                            |
| Brand/story asset builds, renderer | Node scripts, zero-dependency pottery renderer                 | `scripts/`, `tools/`, `assets/`   |

Documentation: [architecture](docs/ARCHITECTURE.md) · [security](docs/SECURITY.md) ·
[deployment](docs/DEPLOYMENT.md)

## What it does

- **Storefront** — cinematic homepage (CSS hero reveal, scroll-scrubbed turntable, collection
  reveal, close-ups, category transitions), catalogue with search/filter/sort/pagination,
  product pages with variants, cart, checkout, order confirmation, order tracking, policies,
  SEO (metadata, canonical URLs, sitemap, robots, Product/Breadcrumb/Store JSON-LD).
- **Checkout** — the backend re-prices every line, reserves stock and builds the official
  `wa.me` link from the **saved** order; this app only displays server quotes.
- **Admin** (`/admin`) — dashboard, products (crop/upload/WebP pipeline), categories, image
  library, orders, customers, inventory, promotions, homepage content, store settings, admin
  users & roles, audit log, account & sessions. The API enforces every permission.

## How it talks to the backend

`NEXT_PUBLIC_API_BASE_URL` is the backend's URL. Only `lib/api/base-url.ts` reads it.

- Server-side rendering fetches the backend directly through that module (`lib/api/server.ts`).
- The browser never calls the backend's domain. It requests same-origin `/api/v1/*` and
  `/media/*`, and `proxy.ts` forwards them. So the admin session cookie stays first-party on
  this domain, which server-rendered admin pages rely on, and no CORS or third-party cookies are
  involved.
- With `INTERNAL_API_TOKEN` set (same value as the backend), forwarded requests carry the
  visitor's address, so the backend rate-limits each visitor separately.

## Quick start (development)

Requirements: Node.js 22.12+ (24 recommended) and a running backend (see its README).

```bash
npm install
cp .env.example .env.local    # NEXT_PUBLIC_API_BASE_URL=http://localhost:4000; REVALIDATE_SECRET must match the backend's
npm run dev                   # http://localhost:3000 and http://localhost:3000/admin
```

## Quality gates

```bash
npm run typecheck
npm run lint
npm run build
# End-to-end, against an isolated backend (database jmh_e2e, never the dev/prod database):
#   in jigar-pot-shop-backend: scripts/e2e-stack.sh prepare && scripts/e2e-stack.sh api   (API :4100)
scripts/e2e-web.sh &                                   # production build on :3100
E2E_BASE_URL=http://localhost:3100 npm run test:e2e
```

## Shared contracts

`shared/` is a copy of the backend's `shared/src` (Zod schemas, DTO types, labels, display
helpers). Don't edit it here. Change it in the backend, then run
`npm run shared:export -- ../jigar-pot-shop` there. `shared/VERSION` records the exported content hash.

## Deployment

- **Vercel**: import this repository as a Next.js project, with the repository root as the root
  directory.
- **Containers**: `docker build --build-arg NEXT_PUBLIC_API_BASE_URL=… -t jmh-web .`

Environment variables and rollout order are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
