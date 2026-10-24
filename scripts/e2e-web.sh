#!/usr/bin/env bash
# Frontend half of the isolated end-to-end environment (production build on http://localhost:3100).
# Start the API first from the backend repository: scripts/e2e-stack.sh prepare && scripts/e2e-stack.sh api
# (API on http://localhost:4100, database jmh_e2e — never the development or production database).
# Then: scripts/e2e-web.sh   and   E2E_BASE_URL=http://localhost:3100 npm run test:e2e
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export NEXT_PUBLIC_API_BASE_URL=http://localhost:4100 NEXT_PUBLIC_SITE_URL=http://localhost:3100
export REVALIDATE_SECRET=e2e-revalidate-secret-123
export INTERNAL_API_TOKEN=e2e-internal-token-0123456789abcdef   # test-only; same as the backend script
if [[ "${SKIP_BUILD:-}" != "1" ]]; then npm run build; fi
NODE_ENV=production exec npx next start --port 3100
