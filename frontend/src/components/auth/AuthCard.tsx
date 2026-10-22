import Image from 'next/image';
import type { ReactNode } from 'react';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <Image src="/images/logo-icon.png" alt="" width={44} height={44} className="rounded-full" />
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}
