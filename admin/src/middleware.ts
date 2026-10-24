import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from '@/lib/csp';
import { updateSession } from '@/lib/supabase/middleware';

// Tout est privé sauf /login. Chaque page et chaque action revérifie AUSSI le rôle admin côté serveur
// (requireAdmin) : le middleware ne suffit jamais seul.
export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV !== 'production',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const path = request.nextUrl.pathname;
  const isLogin = path === '/login';
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));

  const toLogin = () => {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  };

  let response: NextResponse;
  if (!hasAuthCookie) {
    response = isLogin ? NextResponse.next({ request: { headers: requestHeaders } }) : toLogin();
  } else {
    const result = await updateSession(request, requestHeaders);
    response = !result.user && !isLogin ? toLogin() : result.response;
  }

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'no-store');
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
