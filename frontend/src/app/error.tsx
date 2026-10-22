'use client';

import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <TriangleAlert className="mx-auto h-10 w-10 text-amber-600" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold">{t('error.title')}</h1>
      <p className="mt-2 text-slate-600">{t('err.generic')}</p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="btn btn-primary">{t('error.retry')}</button>
        <Link href="/" className="btn btn-outline">{t('error.home')}</Link>
      </div>
    </div>
  );
}
