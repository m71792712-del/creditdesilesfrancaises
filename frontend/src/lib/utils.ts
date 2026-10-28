export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Param = string | string[] | undefined;
export const one = (v: Param): string | undefined => (Array.isArray(v) ? v[0] : v);

export function parsePage(v: Param): number {
  const n = parseInt(one(v) ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10000) : 1;
}

/** Empêche les redirections ouvertes (?next=https://site-malveillant). */
export function safeNext(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}

export function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
}

const intl = (locale: string) => (locale === 'fr' ? 'fr-FR' : 'en-GB');

export function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(intl(locale), { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatDate(iso: string, locale: string, withTime = false): string {
  return new Intl.DateTimeFormat(intl(locale), {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' as const } : {}),
    timeZone: 'America/Guadeloupe',
  }).format(new Date(iso));
}

export function initials(first: string, last: string): string {
  return `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase() || '?';
}


/** Transforme un nom (ex. « American Express ») en identifiant de fichier (ex. « american-express »). */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}