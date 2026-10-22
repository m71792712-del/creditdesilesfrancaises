interface CspOptions {
  nonce: string;
  isDev: boolean;
  supabaseUrl?: string;
  captcha: boolean;
}

/** Content-Security-Policy stricte avec nonce. Les scripts inline de Next.js reçoivent le nonce automatiquement. */
export function buildCsp({ nonce, isDev, supabaseUrl, captcha }: CspOptions): string {
  let supabaseOrigin = '';
  try {
    supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';
  } catch {
    supabaseOrigin = '';
  }
  const turnstile = 'https://challenges.cloudflare.com';
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(captcha ? [turnstile] : []), ...(isDev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", ...(supabaseOrigin ? [supabaseOrigin] : []), ...(captcha ? [turnstile] : []), ...(isDev ? ['ws://localhost:*'] : [])],
    'frame-src': captcha ? [turnstile] : ["'none'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!isDev) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}
