interface CspOptions {
  nonce: string;
  isDev: boolean;
  supabaseUrl?: string;
}

/** Content-Security-Policy stricte avec nonce. Les scripts inline de Next.js reçoivent le nonce automatiquement. */
export function buildCsp({ nonce, isDev, supabaseUrl }: CspOptions): string {
  let supabaseOrigin = '';
  try {
    supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';
  } catch {
    supabaseOrigin = '';
  }
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", ...(supabaseOrigin ? [supabaseOrigin] : []), ...(isDev ? ['ws://localhost:*'] : [])],
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!isDev) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}
