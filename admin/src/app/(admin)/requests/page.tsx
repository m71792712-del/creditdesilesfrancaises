import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, PageHeader, Pagination, StatusBadge } from '@/components/ui';
import { LOAN_STATUSES, STATUS_LABELS, type LoanListRow } from '@/lib/types';
import { formatDate, formatMoney, one, PAGE_SIZE, parsePage } from '@/lib/utils';

export const metadata = { title: 'Demandes de prêt' };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const status = (LOAN_STATUSES as readonly string[]).includes(one(sp.status) ?? '') ? one(sp.status)! : '';
  const purposeParam = /^[a-z_]{2,40}$/.test(one(sp.purpose) ?? '') ? one(sp.purpose)! : '';

  const supabase = await createClient();
  const { data: purposes } = await supabase.from('loan_purposes').select('code,label_fr').order('sort_order');

  let query = supabase
    .from('loan_requests')
    .select('id,amount,currency,purpose_code,custom_bank_name,status,created_at,profiles(first_name,last_name,email),banks(name),loan_purposes(label_fr)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq('status', status);
  if (purposeParam) query = query.eq('purpose_code', purposeParam);
  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as LoanListRow[];

  return (
    <>
      <PageHeader title="Demandes de prêt" subtitle="Cliquez sur une demande pour l’examiner et changer son statut" />
      <form className="card mb-5 flex flex-wrap items-end gap-3 !p-4" method="get">
        <div>
          <label htmlFor="status" className="label">Statut</label>
          <select id="status" name="status" defaultValue={status} className="input">
            <option value="">Tous</option>
            {LOAN_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="purpose" className="label">Motif</label>
          <select id="purpose" name="purpose" defaultValue={purposeParam} className="input">
            <option value="">Tous</option>
            {(purposes ?? []).map((p: { code: string; label_fr: string }) => <option key={p.code} value={p.code}>{p.label_fr}</option>)}
          </select>
        </div>
        <button className="btn btn-primary">Filtrer</button>
        {(status || purposeParam) && <Link href="/requests" className="btn btn-outline">Réinitialiser</Link>}
      </form>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Impossible de charger les demandes.</p>}
      {rows.length === 0 ? (
        <EmptyState text="Aucune demande ne correspond à ces critères." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-soft">
          <table className="w-full">
            <thead className="border-b border-slate-100">
              <tr><th className="th">Demandeur</th><th className="th">Montant</th><th className="th">Motif</th><th className="th">Banque</th><th className="th">Statut</th><th className="th">Date</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-sky-50/50">
                  <td className="td">
                    <Link className="font-medium text-ocean-600 hover:underline" href={`/requests/${r.id}`}>{r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : '—'}</Link>
                    <div className="text-xs text-slate-500">{r.profiles?.email}</div>
                  </td>
                  <td className="td whitespace-nowrap">{formatMoney(r.amount, r.currency)}</td>
                  <td className="td">{r.loan_purposes?.label_fr ?? r.purpose_code}</td>
                  <td className="td">{r.banks?.name ?? (r.custom_bank_name ? `${r.custom_bank_name} (autre)` : '—')}</td>
                  <td className="td"><StatusBadge status={r.status} /></td>
                  <td className="td whitespace-nowrap">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={count ?? 0} pageSize={PAGE_SIZE} basePath="/requests" params={{ status, purpose: purposeParam }} />
    </>
  );
}
