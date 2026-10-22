import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { RequestsTable } from '@/components/loan/RequestsTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { requireUser } from '@/lib/auth';
import { PAGE_SIZE } from '@/lib/config';
import { getLoans } from '@/lib/data';
import { getT } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { parsePage } from '@/lib/utils';

export const metadata: Metadata = { title: 'Mes demandes' };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getT();
  const user = await requireUser();
  const page = parsePage((await searchParams).page);
  const supabase = await createClient();
  const { loans, total } = await getLoans(supabase, user.id, page);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('req.title')}</h1>
        <Link href="/apply" className="btn btn-green"><Plus className="h-4 w-4" aria-hidden /> {t('shell.apply')}</Link>
      </div>
      <div className="mt-6">
        {loans.length === 0 ? (
          <EmptyState title={t('dash.empty.title')} text={t('dash.empty.text')}>
            <Link href="/apply" className="btn btn-primary">{t('shell.apply')}</Link>
          </EmptyState>
        ) : (
          <RequestsTable loans={loans} t={t} locale={locale} />
        )}
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/dashboard/requests" t={t} />
      </div>
    </div>
  );
}
