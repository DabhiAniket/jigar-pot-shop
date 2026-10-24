'use client';

import type { ApiErrorBody } from '@jmh/shared';

export class ClientApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;

/** Set by the admin shell from the server-verified session. */
export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** Same-origin JSON request to the API (proxied under /api/v1). */
export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
  const headers: Record<string, string> = { accept: 'application/json', ...options.headers };
  if (options.body !== undefined && !(options.body instanceof FormData))
    headers['content-type'] = 'application/json';
  if (method !== 'GET' && csrfToken && path.startsWith('/admin'))
    headers['x-csrf-token'] = csrfToken;

  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body:
        options.body === undefined
          ? undefined
          : options.body instanceof FormData
            ? options.body
            : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ClientApiError(
      0,
      'NETWORK_ERROR',
      'Could not reach the server. Check your connection and try again.',
    );
  }

  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as
    (ApiErrorBody & { data?: unknown }) | null;
  if (!response.ok) {
    if (
      response.status === 401 &&
      path.startsWith('/admin') &&
      !path.startsWith('/admin/auth/login')
    ) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload so the server layout re-reads the session cookie
      window.location.assign(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ClientApiError(
      response.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? 'Something went wrong. Please try again.',
      body?.error?.fields ?? {},
    );
  }
  return body as T;
}

/** Upload with progress (fetch cannot report upload progress). */
export function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress: (fraction: number) => void,
): { promise: Promise<T>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<T>((resolve, reject) => {
    xhr.open('POST', `/api/v1${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('accept', 'application/json');
    if (csrfToken) xhr.setRequestHeader('x-csrf-token', csrfToken);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () =>
      reject(
        new ClientApiError(0, 'NETWORK_ERROR', 'The upload was interrupted. Please try again.'),
      );
    xhr.onabort = () => reject(new ClientApiError(0, 'ABORTED', 'Upload cancelled.'));
    xhr.onload = () => {
      let body: (ApiErrorBody & { data?: unknown }) | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else
        reject(
          new ClientApiError(
            xhr.status,
            body?.error?.code ?? 'HTTP_ERROR',
            body?.error?.message ??
              (xhr.status === 413 ? 'The file is too large.' : 'Upload failed.'),
            body?.error?.fields ?? {},
          ),
        );
    };
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}
