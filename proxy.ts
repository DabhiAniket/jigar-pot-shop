import { NextResponse, type NextRequest } from 'next/server';
import { apiBaseUrl } from './lib/api/base-url';

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/reset-password'];
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;

/**
 * Visitor address as seen by the platform in front of this app. Vercel sets X-Forwarded-For to
 * the client address; nginx-style proxies append it, so the right-most entry is the one the
 * nearest trusted proxy observed.
 */
function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const last = forwarded?.split(',').at(-1)?.trim();
  return last || request.headers.get('x-real-ip');
}

/**
 * Browser calls stay same-origin (/api/v1, /media) so the admin session cookie is first-party;
 * they are forwarded to the separately deployed API. With INTERNAL_API_TOKEN set, the visitor's
 * address travels along so the API rate-limits per visitor rather than per web server.
 */
function forwardToApi(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.delete('x-client-ip');
  headers.delete('x-internal-token');
  const ip = clientIp(request);
  if (INTERNAL_TOKEN && ip) {
    headers.set('x-client-ip', ip);
    headers.set('x-internal-token', INTERNAL_TOKEN);
  }
  return NextResponse.rewrite(new URL(`${apiBaseUrl()}${pathname}${search}`), {
    request: { headers },
  });
}

/**
 * Cheap first gate for admin pages: without a session cookie, go straight to sign-in.
 * The real check happens server-side in the admin layout (which asks the API to validate the
 * session), and the API authorises every admin request on its own.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/v1/') || pathname.startsWith('/media/'))
    return forwardToApi(request);
  if (PUBLIC_ADMIN_PATHS.some((path) => pathname.startsWith(path))) return NextResponse.next();
  const hasSession =
    request.cookies.has('__Host-jmh_session') || request.cookies.has('jmh_session');
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/v1/:path*', '/media/:path*'],
};
