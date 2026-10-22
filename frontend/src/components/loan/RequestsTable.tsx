import Link from 'next/link';
import { Eye } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { LoanWithPurpose } from '@/lib/data';
import { purposeLabel, type Locale, type TFunction } from '@/lib/i18n/shared';
import { formatDate, formatMoney } from '@/lib/utils';

export function RequestsTable({ loans, t, locale }: { loans: LoanWithPurpose[]; t: TFunction; locale: Locale }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 bg-white">
        <caption className="sr-only">{t('req.title')}</caption>
        <thead className="bg-slate-50">
          <tr>
            <th className="th" scope="col">{t('req.date')}</th>
            <th className="th" scope="col">{t('req.amount')}</th>
            <th className="th" scope="col">{t('req.purpose')}</th>
            <th className="th" scope="col">{t('req.status')}</th>
            <th className="th" scope="col"><span className="sr-only">{t('req.actions')}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loans.map((l) => (
            <tr key={l.id}>
              <td className="td whitespace-nowrap">{formatDate(l.created_at, locale)}</td>
              <td className="td whitespace-nowrap font-medium">{formatMoney(Number(l.amount), l.currency, locale)}</td>
              <td className="td">{l.loan_purposes ? purposeLabel(l.loan_purposes, locale) : l.purpose_code}</td>
              <td className="td"><StatusBadge status={l.status} /></td>
              <td className="td text-right">
                <Link href={`/dashboard/requests/${l.id}`} className="inline-flex rounded-lg p-2 text-ocean-600 hover:bg-sky-50" aria-label={`${t('common.view')} — ${formatDate(l.created_at, locale)}`}>
                  <Eye className="h-4 w-4" aria-hidden />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
