import { createT, type Locale }
from './shared';

export async function
getLocal(): Promise<Locale> {
  return 'fr';
}

export async function getT() {
  const locale = await
  getLocale();
  return { locale, t :
    createT(locale) };
}