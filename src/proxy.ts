import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_FLAG_COOKIE = 'soc_auth';
const PUBLIC_PATHS = ['/login'];

/**
 * Optimistic route guard (Next 16 `proxy`, formerly `middleware`).
 * Only checks the presence flag – the Laravel API remains the real authority
 * and rejects any request without a valid Sanctum token.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthed = request.cookies.get(AUTH_FLAG_COOKIE)?.value === '1';
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!isAuthed && !isPublic) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  if (isAuthed && isPublic) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
