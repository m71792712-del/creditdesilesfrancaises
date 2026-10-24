import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Administration · Crédit des îles françaises', template: '%s · Administration' },
  description: 'Interface d’administration.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#0b2d5e', width: 'device-width', initialScale: 1 };

// Rendu dynamique volontaire : CSP avec nonce par requête et pages lisant la session.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">
        
        {children}
      </body>
    </html>
  );
}
