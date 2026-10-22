import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from '@/lib/csp';
import { updateSession } from '@/lib/supabase/middleware';

const PROTECTED = ['/dashboard', '/apply', '/profile'];

// 1) CSP avec nonce (une par requête)  2) rafraîchissement de session  3) première barrière sur les routes privées.
// Chaque page / action revérifie AUSSI l'utilisateur côté serveur : le middleware ne suffit jamais seul.
export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV !== 'production',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    captcha: process.env.NEXT_PUBLIC_CAPTCHA_ENABLED === 'true',
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));

  let response: NextResponse;
  if (!hasAuthCookie) {
    // Visiteur anonyme : aucun appel réseau à Supabase (pages publiques rapides).
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('next', path);
      response = NextResponse.redirect(url);
    } else {
      response = NextResponse.next({ request: { headers: requestHeaders } });
    }
  } else {
    const result = await updateSession(request, requestHeaders);
    response = result.response;
    if (!result.user && isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('next', path);
      response = NextResponse.redirect(url);
    }
  }

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
