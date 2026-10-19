import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route guard (Next.js 16).
 * Passthrough for all routes since authentication is handled seamlessly by client layout.
 */
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
