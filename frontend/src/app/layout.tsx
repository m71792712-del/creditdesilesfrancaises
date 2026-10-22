import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { DemoBanner } from '@/components/layout/DemoBanner';
import { APP_NAME } from '@/lib/config';
import { getT } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n/provider';
import './globals.css';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: 'Plateforme de demande de prêt.',
};
export const viewport: Viewport = { themeColor: '#0b2d5e', width: 'device-width', initialScale: 1 };

// Rendu dynamique volontaire : langue lue dans les cookies / en-têtes et CSP avec nonce par requête.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getT();
  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <I18nProvider locale={locale}>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
            {t('nav.skip')}
          </a>
          <DemoBanner />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
