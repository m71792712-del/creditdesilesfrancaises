'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { CAPTCHA_ENABLED, TURNSTILE_SITE_KEY } from '@/lib/config';

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

/** Cloudflare Turnstile. Rien n'est rendu (et aucun script chargé) tant que NEXT_PUBLIC_CAPTCHA_ENABLED n'est pas « true ». */
export function Captcha({ nonce, resetKey }: { nonce?: string; resetKey?: unknown }) {
  // Un jeton Turnstile est à usage unique : on réinitialise le widget après chaque tentative.
  useEffect(() => {
    if (CAPTCHA_ENABLED) window.turnstile?.reset();
  }, [resetKey]);

  if (!CAPTCHA_ENABLED || !TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" nonce={nonce} />
      <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-theme="light" />
    </>
  );
}
