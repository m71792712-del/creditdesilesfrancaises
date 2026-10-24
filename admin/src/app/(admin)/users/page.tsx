import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, PageHeader, Pagination } from '@/components/ui';
import type { UserRow } from '@/lib/types';
import { escapeLike, formatDate, one, PAGE_SIZE, parsePage } from '@/lib/utils';

export const metadata = { title: 'Utilisateurs' };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = escapeLike(one(sp.q) ?? '');

  const supabase = await createClient();
  let query = supabase
    .from('profiles')
    .select('id,first_name,last_name,email,phone,role,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, count } = await query;
  const users = (data ?? []) as UserRow[];

  return (
    <>
      <PageHeader title="Utilisateurs" subtitle="Comptes inscrits sur le site (lecture seule)" />
      <form method="get" className="card mb-5 flex flex-wrap items-end gap-3 !p-4">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="label">Rechercher (nom, prénom ou e-mail)</label>
          <input id="q" name="q" defaultValue={q} maxLength={60} className="input" />
        </div>
        <button className="btn btn-primary">Rechercher</button>
      </form>

      {users.length === 0 ? (
        <EmptyState text="Aucun utilisateur trouvé." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-soft">
          <table className="w-full">
            <thead className="border-b border-slate-100"><tr><th className="th">Nom</th><th className="th">E-mail</th><th className="th">Téléphone</th><th className="th">Rôle</th><th className="th">Inscription</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="td font-medium">{u.first_name} {u.last_name}</td>
                  <td className="td">{u.email}</td>
                  <td className="td whitespace-nowrap">{u.phone || '—'}</td>
                  <td className="td">{u.role === 'admin' ? <span className="rounded-full bg-navy-100 px-2.5 py-1 text-xs font-semibold text-navy-800">Admin</span> : 'Utilisateur'}</td>
                  <td className="td whitespace-nowrap">{formatDate(u.created_at, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={count ?? 0} pageSize={PAGE_SIZE} basePath="/users" params={{ q }} />
    </>
  );
}
