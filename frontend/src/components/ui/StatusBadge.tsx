'use client';

import { useI18n } from '@/lib/i18n/provider';

const STYLES: Record<string, string> = {
  pending: 'bg-sky-100 text-sky-800',
  under_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {t(`status.${status}`)}
    </span>
  );
}
