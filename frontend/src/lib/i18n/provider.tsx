'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createT, type Locale, type TFunction } from './shared';

const Ctx = createContext<{ locale: Locale; t: TFunction } | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createT(locale) }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n doit être utilisé dans <I18nProvider>');
  return ctx;
}
