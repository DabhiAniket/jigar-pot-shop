/**
 * Where the backend lives — the single place the frontend reads it from.
 * NEXT_PUBLIC_API_BASE_URL is the backend's public URL (not a secret). API_INTERNAL_URL can
 * override it with a private-network address (e.g. http://api:4000 in docker compose).
 * Browsers never call this URL directly: they use same-origin /api/v1 and /media, which proxy.ts
 * forwards here, so the admin session cookie stays first-party on the frontend's domain.
 */
export function apiBaseUrl(): string {
  const url =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');
  if (!url) throw new Error('NEXT_PUBLIC_API_BASE_URL is not set: point it at the backend URL.');
  return url.replace(/\/+$/, '');
}
