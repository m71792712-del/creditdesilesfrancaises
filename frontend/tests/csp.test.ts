import { describe, expect, it } from 'vitest';
import { buildCsp } from '@/lib/csp';

describe('Content-Security-Policy', () => {
  const prod = buildCsp({ nonce: 'abc123', isDev: false, supabaseUrl: 'https://xyz.supabase.co/rest/v1', captcha: false });
  it('utilise un nonce et interdit eval, objets et cadres', () => {
    expect(prod).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(prod).not.toContain('unsafe-eval');
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("frame-src 'none'");
    expect(prod).toContain('upgrade-insecure-requests');
  });
  it('limite connect-src à l’origine Supabase', () => {
    expect(prod).toContain("connect-src 'self' https://xyz.supabase.co");
    expect(prod).not.toContain('https://xyz.supabase.co/rest');
  });
  it('autorise Turnstile uniquement si le CAPTCHA est activé', () => {
    expect(prod).not.toContain('challenges.cloudflare.com');
    expect(buildCsp({ nonce: 'n', isDev: false, captcha: true })).toContain('https://challenges.cloudflare.com');
  });
  it('autorise eval uniquement en développement', () => {
    expect(buildCsp({ nonce: 'n', isDev: true, captcha: false })).toContain("'unsafe-eval'");
  });
});
