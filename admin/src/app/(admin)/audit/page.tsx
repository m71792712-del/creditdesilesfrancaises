import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, PageHeader, Pagination } from '@/components/ui';
import type { AuditRow } from '@/lib/types';
import { formatDate, PAGE_SIZE, parsePage } from '@/lib/utils';

export const metadata = { title: 'Journal d’audit' };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const page = parsePage((await searchParams).page);
  const supabase = await createClient();
  const { data, count } = await supabase
    .from('audit_logs')
    .select('id,actor_id,action,entity_type,entity_id,details,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as AuditRow[];

  return (
    <>
      <PageHeader title="Journal d’audit" subtitle="Actions sensibles enregistrées par la base (ajout seul, non modifiable)" />
      {rows.length === 0 ? (
        <EmptyState text="Aucune entrée pour le moment." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-soft">
          <table className="w-full">
            <thead className="border-b border-slate-100"><tr><th className="th">Date</th><th className="th">Action</th><th className="th">Objet</th><th className="th">Détails</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={String(r.id)} className="align-top">
                  <td className="td whitespace-nowrap">{formatDate(r.created_at)}</td>
                  <td className="td font-mono text-xs">{r.action}</td>
                  <td className="td text-xs">{r.entity_type}{r.entity_id ? <div className="font-mono text-slate-500">{r.entity_id.slice(0, 8)}…</div> : null}</td>
                  <td className="td max-w-xs break-words font-mono text-xs text-slate-600">{r.details ? JSON.stringify(r.details) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={count ?? 0} pageSize={PAGE_SIZE} basePath="/audit" params={{}} />
    </>
  );
}
