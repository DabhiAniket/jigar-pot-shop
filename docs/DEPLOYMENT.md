# Deployment

This repository is the frontend (storefront and admin UI). The backend is deployed separately from
[`jigar-pot-shop-backend`](https://github.com/DabhiAniket/jigar-pot-shop-backend). Its
`docs/DEPLOYMENT.md` covers the API, database, storage, migrations, backups and monitoring.

## How requests flow

```
Browser ──► frontend (this app) ──┬──► pages: server-rendered, data fetched from the backend
                                  └──► /api/v1/*, /media/* ──► proxy.ts ──► backend
```

The browser only ever talks to the frontend's domain. The admin session cookie is set by the
backend but delivered through the frontend, so it is first-party here. Server-rendered admin
pages need it, and Safari's third-party cookie blocking can't break sign-in.

## Vercel

- Import this repository. Framework: Next.js (detected). **Root Directory**: the repository root.
  No `vercel.json` is needed.
- Environment variables (Production):

  | Variable                   | Value                                                                    |
  | -------------------------- | ------------------------------------------------------------------------ |
  | `NEXT_PUBLIC_API_BASE_URL` | backend production URL, e.g. `https://api.example.com` (not a secret)    |
  | `NEXT_PUBLIC_SITE_URL`     | this site's public URL (canonical URLs, sitemap, Open Graph)             |
  | `REVALIDATE_SECRET`        | same value as the backend: lets it refresh cached pages after edits      |
  | `INTERNAL_API_TOKEN`       | same value as the backend: per-visitor rate limits, server-side requests |

  Do not add backend variables here (`MONGODB_URI`, `APP_SECRET`, storage keys…). Do not set
  `NODE_ENV`; the build script forces `NODE_ENV=production` regardless.

- `NEXT_PUBLIC_` values are fixed at build time: redeploy after changing the backend URL.
- Point `NEXT_PUBLIC_API_BASE_URL` at the backend's **production** domain. Vercel protects preview
  deployments by default, and a protected URL returns Vercel's login page instead of JSON.
- The backend's `FRONTEND_URL` (or `PUBLIC_WEB_URL`) must be this site's production origin.
  Admin sign-in and checkout check the browser's `Origin` against it.

### Rollout

1. Deploy the backend first and confirm `GET https://<backend>/ready`.
2. Set the variables above and deploy this project.
3. Warm the cache: `POST https://<frontend>/api/revalidate` with header `x-revalidate-secret` and
   body `{"tags":["catalog","settings","home","promotions"]}`. A build made while the backend was
   unreachable contains placeholder pages; this replaces them immediately.

Health check: any page, e.g. `GET /robots.txt`.

## Containers

```bash
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://www.example.com -t jmh-web .
docker run -p 3000:3000 -e REVALIDATE_SECRET=… -e INTERNAL_API_TOKEN=… jmh-web
```

`API_INTERNAL_URL` can override the backend URL at runtime with a private-network address
(e.g. `http://api:4000` in docker compose). The backend repository's `infra/compose/` runs the
full stack on one host and builds this image from a sibling checkout.

## Rollback

Redeploy the previous deployment (Vercel → Deployments → Promote) or image tag. The frontend
holds no data, so rolling it back needs no other step besides the cache warm-up above.
