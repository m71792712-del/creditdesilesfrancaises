export const APP_NAME = 'Crédit des îles françaises';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const CAPTCHA_ENABLED = process.env.NEXT_PUBLIC_CAPTCHA_ENABLED === 'true';
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
export const PAGE_SIZE = 10;

// Limites de repli si app_settings est illisible (les vraies valeurs viennent de la base).
export const DEFAULT_LIMITS = { min: 500, max: 100000 };

// Animation de traitement : 1 % -> 81 % (rapide) puis 81 % -> 94 % (lent), ~8 s.
export const SIMULATION = { totalMs: 8000, phase1EndMs: 4500, start: 1, mid: 81, end: 94 } as const;
