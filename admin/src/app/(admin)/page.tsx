import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import { STATUS_LABELS, type LoanListRow, type Stats } from '@/lib/types';
import { formatDate, formatMoney } from '@/lib/utils';

export const metadata = { title: 'Tableau de bord' };

export default async function DashboardPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: stats, error }, { data: recent }] = await Promise.all([
    supabase.rpc('admin_stats'),
    supabase
      .from('loan_requests')
      .select('id,amount,currency,purpose_code,custom_bank_name,status,created_at,profiles(first_name,last_name,email),banks(name),loan_purposes(label_fr)')
      .order('created_at', { ascending: false })
      .limit(6),
  ]);
  const s = (stats ?? null) as Stats | null;
  const rows = (recent ?? []) as unknown as LoanListRow[];

  const cards = s
    ? [
        { label: 'Utilisateurs', value: s.users },
        { label: 'Demandes de prêt', value: s.loans },
        { label: 'Demandes (7 derniers jours)', value: s.loans_last_7_days },
        { label: 'Banques actives', value: s.banks_active },
        { label: 'Suggestions à traiter', value: s.pending_suggestions, href: '/suggestions' },
      ]
    : [];

  return (
    <>
      <PageHeader title="Tableau de bord" subtitle="Vue d’ensemble de la plateforme" />
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Impossible de charger les statistiques (le compte est-il bien promu admin ?).</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c) => {
          const inner = (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="mt-2 text-3xl font-bold text-navy-900">{c.value}</p>
            </>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="card block transition hover:border-ocean-500">{inner}</Link>
          ) : (
            <div key={c.label} className="card">{inner}</div>
          );
        })}
      </div>

      {s && (
        <section className="mt-6 card" aria-labelledby="by-status">
          <h2 id="by-status" className="mb-4 text-lg font-semibold">Demandes par statut</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            {Object.keys(STATUS_LABELS).map((k) => {
              const n = s.by_status?.[k] ?? 0;
              const pct = s.loans > 0 ? Math.round((n / s.loans) * 100) : 0;
              return (
                <Link key={k} href={`/requests?status=${k}`} className="rounded-xl border border-slate-200 p-4 hover:border-ocean-500">
                  <StatusBadge status={k} />
                  <p className="mt-2 text-2xl font-bold">{n}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-ocean-500" style={{ width: `${pct}%` }} /></div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6" aria-labelledby="recent">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent" className="text-lg font-semibold">Dernières demandes</h2>
          <Link href="/requests" className="text-sm font-medium text-ocean-600 hover:underline">Tout voir →</Link>
        </div>
        {rows.length === 0 ? (
          <EmptyState text="Aucune demande pour le moment." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-soft">
            <table className="w-full">
              <thead className="border-b border-slate-100"><tr><th className="th">Demandeur</th><th className="th">Montant</th><th className="th">Motif</th><th className="th">Statut</th><th className="th">Date</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-sky-50/50">
                    <td className="td"><Link className="font-medium text-ocean-600 hover:underline" href={`/requests/${r.id}`}>{r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : '—'}</Link></td>
                    <td className="td whitespace-nowrap">{formatMoney(r.amount, r.currency)}</td>
                    <td className="td">{r.loan_purposes?.label_fr ?? r.purpose_code}</td>
                    <td className="td"><StatusBadge status={r.status} /></td>
                    <td className="td whitespace-nowrap">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
