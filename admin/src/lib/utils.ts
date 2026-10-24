export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PAGE_SIZE = 15;

type Param = string | string[] | undefined;
export const one = (v: Param): string | undefined => (Array.isArray(v) ? v[0] : v);

export function parsePage(v: Param): number {
  const n = parseInt(one(v) ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10000) : 1;
}

export function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

/** Échappe les caractères spéciaux du filtre PostgREST .or() (CONTRACT.md §4). */
export function escapeLike(value: string): string {
  return value.replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatDate(iso: string, withTime = true): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' as const } : {}),
    timeZone: 'America/Guadeloupe',
  }).format(new Date(iso));
}
