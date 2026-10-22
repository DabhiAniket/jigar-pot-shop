import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/reset-password'];

/**
 * Cheap first gate for admin pages: without a session cookie, go straight to sign-in.
 * The real check happens server-side in the admin layout (which asks the API to validate the
 * session), and the API authorises every admin request on its own.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
  matcher: ['/admin/:path*'],
};
