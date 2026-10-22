import Image from 'next/image';
import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { PublicNavbar } from '@/components/layout/PublicNavbar';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicNavbar />
      <main id="main" className="relative isolate flex-1">
        <Image src="/images/panel.webp" alt="" fill sizes="100vw" quality={60} className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-white/70 backdrop-blur-[2px]" aria-hidden />
        <div className="mx-auto w-full max-w-md px-4 py-10">{children}</div>
      </main>
      <Footer />
    </>
  );
}
