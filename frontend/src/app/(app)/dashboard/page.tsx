import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CircleCheck, CircleX, Clock, FileText, Plus } from 'lucide-react';
import { RequestsTable } from '@/components/loan/RequestsTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { getProfile, requireUser } from '@/lib/auth';
import { getLoanStats, getLoans } from '@/lib/data';
import { getT } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Tableau de bord' };

export default async function DashboardPage() {
  const { t, locale } = await getT();
  const user = await requireUser();
  const profile = await getProfile();
  const supabase = await createClient();
  const [stats, { loans }] = await Promise.all([getLoanStats(supabase, user.id), getLoans(supabase, user.id, 1, 5)]);

  const cards = [
    { icon: FileText, label: t('dash.stat.total'), value: stats.total, tone: 'bg-sky-50 text-ocean-600' },
    { icon: Clock, label: t('dash.stat.inprogress'), value: stats.inProgress, tone: 'bg-blue-50 text-blue-600' },
    { icon: CircleCheck, label: t('dash.stat.approved'), value: stats.approved, tone: 'bg-emerald-50 text-emerald-600' },
    { icon: CircleX, label: t('dash.stat.rejected'), value: stats.rejected, tone: 'bg-red-50 text-red-600' },
  ];
  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : (user.email ?? '');

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t('dash.hello', { name })}</h1>
            <p className="mt-1 text-slate-600">{t('dash.overview')}</p>
          </div>
          <Link href="/apply" className="btn btn-green"><Plus className="h-4 w-4" aria-hidden /> {t('shell.apply')}</Link>
        </div>

        <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(({ icon: Icon, label, value, tone }) => (
            <li key={label} className="card p-4">
              <span className={`grid h-9 w-9 place-items-center rounded-full ${tone}`}><Icon className="h-4 w-4" aria-hidden /></span>
              <p className="mt-2 text-xs text-slate-500">{label}</p>
              <p className="text-3xl font-bold text-navy-900">{value}</p>
            </li>
          ))}
        </ul>

        <section className="card mt-6">
          <h2 className="mb-4 text-lg font-semibold">{t('dash.latest')}</h2>
          {loans.length === 0 ? (
            <EmptyState title={t('dash.empty.title')} text={t('dash.empty.text')}>
              <Link href="/apply" className="btn btn-primary">{t('shell.apply')}</Link>
            </EmptyState>
          ) : (
            <>
              <RequestsTable loans={loans} t={t} locale={locale} />
              <Link href="/dashboard/requests" className="btn btn-primary mt-4">{t('dash.seeAll')}</Link>
            </>
          )}
        </section>
      </div>

      <aside className="relative hidden overflow-hidden rounded-2xl xl:block" aria-label={t('dash.panel')}>
        <Image src="/images/panel.webp" alt="" fill sizes="260px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-900/85 via-navy-900/20 to-transparent" aria-hidden />
        <p className="absolute inset-x-4 bottom-5 text-lg font-bold leading-snug text-white">{t('dash.panel')}</p>
      </aside>
    </div>
  );
}
