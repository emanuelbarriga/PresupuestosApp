import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware mínimo para despachar la ruta raíz.
 *
 * La autenticación real y los guards de navegación se manejan del lado cliente:
 *   - AuthContext (onAuthStateChanged) en app/layout.tsx
 *   - Client guard (spinner + membership check) en app/[company]/layout.tsx
 *
 * La seguridad REAL está en Firestore Security Rules en el servidor.
 *
 * NOTA: Firebase Auth SDK v9+ almacena sesiones en IndexedDB, NO en cookies.
 *       Cualquier intento de verificar auth en Edge middleware (sin firebase-admin)
 *       requeriría un mecanismo custom de cookie que añade complejidad accidental
 *       sin beneficio real de seguridad. DA-4 (Opción B) delibera esto.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo redirect de raíz — client-side AuthContext redirige al resto
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
