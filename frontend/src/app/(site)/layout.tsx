import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { PublicNavbar } from '@/components/layout/PublicNavbar';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicNavbar />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
