import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SuggestionActions } from '@/components/Forms';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import type { BankRow, SuggestionRow } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Suggestions de banques' };

export default async function SuggestionsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: sugg }, { data: banks }] = await Promise.all([
    supabase.from('bank_suggestions').select('id,name,submit_count,status,created_at,reviewed_at').order('created_at', { ascending: false }).limit(200),
    supabase.from('banks').select('id,name').eq('is_active', true).order('name'),
  ]);
  const all = (sugg ?? []) as SuggestionRow[];
  const pending = all.filter((s) => s.status === 'pending');
  const done = all.filter((s) => s.status !== 'pending');
  const bankList = (banks ?? []) as Pick<BankRow, 'id' | 'name'>[];

  return (
    <>
      <PageHeader title="Suggestions de banques" subtitle="Banques saisies par les utilisateurs via « Autre banque »" />

      <h2 className="mb-3 text-lg font-semibold">À traiter ({pending.length})</h2>
      {pending.length === 0 ? (
        <EmptyState text="Aucune suggestion en attente." />
      ) : (
        <div className="space-y-4">
          {pending.map((s) => (
            <article key={s.id} className="card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{s.name}</h3>
                <span className="text-xs text-slate-500">{s.submit_count} demande{s.submit_count > 1 ? 's' : ''} · {formatDate(s.created_at)}</span>
              </div>
              <SuggestionActions suggestionId={s.id} banks={bankList} />
            </article>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Historique</h2>
      {done.length === 0 ? (
        <EmptyState text="Aucune suggestion traitée." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-soft">
          <table className="w-full">
            <thead className="border-b border-slate-100"><tr><th className="th">Nom</th><th className="th">Votes</th><th className="th">Statut</th><th className="th">Traitée le</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {done.map((s) => (
                <tr key={s.id}>
                  <td className="td">{s.name}</td>
                  <td className="td">{s.submit_count}</td>
                  <td className="td"><StatusBadge status={s.status === 'approved' ? 'approved' : s.status === 'rejected' ? 'rejected' : 'merged'} /></td>
                  <td className="td whitespace-nowrap">{s.reviewed_at ? formatDate(s.reviewed_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
