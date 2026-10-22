import { DEFAULT_LIMITS } from '@/lib/config';
import { en } from './dictionaries/en';
import { fr } from './dictionaries/fr';

export const LOCALES = ['fr', 'en'] as const; // Ajouter une langue : dictionaries/xx.ts puis l'ajouter ici.
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';
export const LOCALE_COOKIE = 'locale';
export const LOCALE_LABELS: Record<Locale, string> = { fr: 'FR', en: 'EN' };

export type Dictionary = Record<string, string>;
export const dictionaries: Record<Locale, Dictionary> = { fr, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Langue du navigateur depuis Accept-Language (ex. « fr-FR,fr;q=0.9,en;q=0.8 »). */
export function pickLocaleFromHeader(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const tags = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: tag.toLowerCase().split('-')[0], q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { lang } of tags) if (isLocale(lang)) return lang;
  return DEFAULT_LOCALE;
}

export function createT(locale: Locale) {
  const dict = dictionaries[locale];
  const fmt = (n: number) => n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB');
  const defaults: Record<string, string | number> = { min: fmt(DEFAULT_LIMITS.min), max: fmt(DEFAULT_LIMITS.max) };
  return (key: string, params?: Record<string, string | number>): string => {
    const text = dict[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
    const all = { ...defaults, ...params };
    return text.replace(/\{(\w+)\}/g, (_, name: string) => String(all[name] ?? `{${name}}`));
  };
}

export type TFunction = ReturnType<typeof createT>;

/** Libellé d'un motif selon la langue (les libellés viennent de la table loan_purposes). */
export function purposeLabel(p: { label_fr: string; label_en: string }, locale: Locale): string {
  return locale === 'en' ? p.label_en : p.label_fr;
}
