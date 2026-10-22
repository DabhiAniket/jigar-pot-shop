import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ApiErrorBody } from '@jmh/shared';

const API_URL = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
  return new ApiError(
    response.status,
    body?.error?.code ?? 'HTTP_ERROR',
    body?.error?.message ?? `Request failed (${response.status})`,
    body?.error?.fields,
  );
}

function baseHeaders(): HeadersInit {
  return {
    accept: 'application/json',
    ...(INTERNAL_TOKEN ? { 'x-internal-token': INTERNAL_TOKEN } : {}),
  };
}

export type CacheTag = 'catalog' | 'settings' | 'home' | 'promotions';

/**
 * Cached public read. Results live in the Next.js data cache for `revalidate` seconds and are
 * refreshed on demand when the API calls /api/revalidate with a matching tag.
 */
export async function publicGet<T>(
  path: string,
  options: { revalidate?: number; tags?: CacheTag[] } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    headers: baseHeaders(),
    next: { revalidate: options.revalidate ?? 60, tags: options.tags ?? ['catalog'] },
  });
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

export async function publicGetOrNull<T>(
  path: string,
  options?: Parameters<typeof publicGet>[1],
): Promise<T | null> {
  try {
    return await publicGet<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Like publicGet, but tolerates the API being unreachable while `next build` prerenders pages
 * (e.g. building a Docker image). The page is then regenerated on its first request.
 */
export async function buildSafeGet<T>(
  path: string,
  fallback: T,
  options?: Parameters<typeof publicGet>[1],
): Promise<T> {
  try {
    return await publicGet<T>(path, options);
  } catch (error) {
    if (IS_BUILD) {
      console.warn(
        `[build] API unavailable for ${path}; rendering a placeholder that revalidates at runtime.`,
      );
      return fallback;
    }
    throw error;
  }
}

/** Uncached read for per-customer data (order confirmation). */
export async function privateGet<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    headers: baseHeaders(),
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

/**
 * Admin read on behalf of the signed-in user: forwards their session cookie to the API, which
 * performs the real authentication and permission checks.
 */
export async function adminGet<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const response = await fetch(`${API_URL}/api/v1/admin${path}`, {
    cache: 'no-store',
    headers: { ...baseHeaders(), cookie: cookieStore.toString() },
  });
  if (response.status === 401) redirect('/admin/login');
  if (!response.ok) {
    const error = await toApiError(response);
    if (error.code === 'PASSWORD_CHANGE_REQUIRED') redirect('/admin/change-password');
    // Error messages are hidden in production builds, so a missing permission becomes a page.
    if (response.status === 403) redirect('/admin/no-access');
    throw error;
  }
  return (await response.json()) as T;
}

/** Like adminGet but returns null for 404 (and 403 is handled by adminGet's redirect). */
export async function adminGetOrNull<T>(path: string): Promise<T | null> {
  try {
    return await adminGet<T>(path);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;
    throw error;
  }
}
