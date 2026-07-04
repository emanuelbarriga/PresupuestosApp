import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPrefixes = [
  '/onboarding',
  '/select-company',
];

// Also protect /[company]/* routes (any path with a company segment)
function isProtected(pathname: string): boolean {
  // Allow public pages
  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  ) {
    return false;
  }

  // Allow API routes — they handle their own auth
  if (pathname.startsWith('/api/')) {
    return false;
  }

  // Root page is handled by client-side redirect
  if (pathname === '/') {
    return false;
  }

  // Protected prefixes
  for (const prefix of protectedPrefixes) {
    if (pathname.startsWith(prefix)) return true;
  }

  // /[company]/* routes — any first segment that could be a company ID
  // but exclude known non-company routes
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 1) {
    const firstSegment = segments[0];
    if (
      firstSegment !== 'login' &&
      firstSegment !== 'register' &&
      !firstSegment.startsWith('_next') &&
      firstSegment !== 'api'
    ) {
      return true;
    }
  }

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  // Check for Firebase session via __session cookie
  // Firebase Auth sets this cookie by default for auth state persistence
  const sessionCookie = request.cookies.get('__session')?.value;

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/ (public images)
     */
    '/((?!_next/static|_next/image|favicon.ico|images/).*)',
  ],
};
