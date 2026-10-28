import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { requireUser } from '@/lib/auth';
import { getHistory, getLoan } from '@/lib/data';
import { getT } from '@/lib/i18n';
import { purposeLabel } from '@/lib/i18n/shared';
import { createClient } from '@/lib/supabase/server';
import { UUID_RE, formatDate, formatMoney } from '@/lib/utils';

export const metadata: Metadata = { title: 'Détail de la demande' };

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, locale } = await getT();
  const user = await requireUser();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const loan = await getLoan(supabase, user.id, id); // la demande d'un autre utilisateur renvoie 404
  if (!loan) notFound();
  const history = await getHistory(supabase, id);

  const purpose = loan.loan_purposes ? purposeLabel(loan.loan_purposes, locale) : loan.purpose_code;
  const bank = loan.banks?.name ?? (loan.custom_bank_name ? t('req.customBank', { name: loan.custom_bank_name }) : t('common.none'));
  const fields: [string, string][] = [
    [t('req.amount'), formatMoney(Number(loan.amount), loan.currency, locale)],
    [t('req.currency'), loan.currency],
    [t('req.createdAt'), formatDate(loan.created_at, locale, true)],
    [t('req.bank'), bank],
    [t('req.cardType'), loan.card_types?.name ?? (loan.custom_card_name ? t('req.customCard', { name: loan.custom_card_name }) : t('common.none'))],
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/requests" className="mb-4 inline-flex items-center gap-1 text-sm text-ocean-600 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t('common.back')}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">{t('req.detail.title')}</h1>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">{t('req.purpose')}</p>
              <h2 className="text-lg font-semibold">{purpose}</h2>
              {loan.purpose_details && <p className="text-sm text-slate-600">{loan.purpose_details}</p>}
            </div>
            <StatusBadge status={loan.status} />
          </div>
          <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            {fields.map(([k, v]) => (
              <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
            <div className="sm:col-span-2"><dt className="text-slate-500">{t('req.description')}</dt><dd className="whitespace-pre-wrap">{loan.description}</dd></div>
          </dl>
        </section>

        <section className="card">
          <h2 className="text-lg font-semibold">{t('req.history')}</h2>
          <ol className="mt-4 space-y-4 border-l-2 border-sky-100 pl-5">
            {history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-lagoon-500" aria-hidden />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {h.old_status ? <><StatusBadge status={h.old_status} /><span aria-hidden>→</span></> : <span className="text-slate-600">{t('req.created')}</span>}
                  <StatusBadge status={h.new_status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatDate(h.created_at, locale, true)}</p>
                {h.comment && <p className="mt-1 text-sm text-slate-700">{h.comment}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
