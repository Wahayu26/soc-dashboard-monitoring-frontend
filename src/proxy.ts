import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_FLAG_COOKIE = 'soc_auth';
const PUBLIC_PATHS = ['/login', '/soc-dashboard-finale/login'];

/**
 * Route guard (Next.js 16).
 * Ensures unauthenticated users land on /soc-dashboard-finale/login first.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthed = request.cookies.get(AUTH_FLAG_COOKIE)?.value === '1';
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!isAuthed && !isPublic) {
    const url = new URL('/soc-dashboard-finale/login', request.url);
    if (pathname !== '/' && pathname !== '/soc-dashboard-finale' && pathname !== '/soc-dashboard-finale/') {
      url.searchParams.set('next', pathname + search);
    }
    return NextResponse.redirect(url);
  }

  if (isAuthed && isPublic) {
    return NextResponse.redirect(new URL('/soc-dashboard-finale/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};

