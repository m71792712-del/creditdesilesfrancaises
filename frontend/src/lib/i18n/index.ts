import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, createT, isLocale, pickLocaleFromHeader, type Locale } from './shared';

export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return pickLocaleFromHeader((await headers()).get('accept-language'));
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: createT(locale) };
}
