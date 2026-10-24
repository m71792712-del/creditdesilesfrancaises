import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { toggleBankAction } from '@/lib/actions';
import { AddBankForm } from '@/components/Forms';
import { PageHeader } from '@/components/ui';
import type { BankRow } from '@/lib/types';

export const metadata = { title: 'Banques' };

export default async function BanksPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from('banks').select('id,slug,name,territory,type,is_active').order('name');
  const banks = (data ?? []) as BankRow[];

  return (
    <>
      <PageHeader title="Banques" subtitle="Liste proposée aux utilisateurs dans le formulaire de demande" />
      <section className="card mb-6" aria-labelledby="add">
        <h2 id="add" className="mb-3 text-lg font-semibold">Ajouter une banque</h2>
        <AddBankForm />
      </section>

      <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-soft">
        <table className="w-full">
          <thead className="border-b border-slate-100"><tr><th className="th">Nom</th><th className="th">Territoire</th><th className="th">Type</th><th className="th">État</th><th className="th"><span className="sr-only">Action</span></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {banks.map((b) => (
              <tr key={b.id}>
                <td className="td font-medium">{b.name}</td>
                <td className="td">{b.territory || '—'}</td>
                <td className="td">{b.type === 'fintech' ? 'Fintech' : 'Banque'}</td>
                <td className="td">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${b.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{b.is_active ? 'Active' : 'Désactivée'}</span>
                </td>
                <td className="td text-right">
                  <form action={toggleBankAction}>
                    <input type="hidden" name="bankId" value={b.id} />
                    <input type="hidden" name="active" value={b.is_active ? 'false' : 'true'} />
                    <button className="btn btn-outline btn-sm">{b.is_active ? 'Désactiver' : 'Réactiver'}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">Désactiver une banque la retire de la liste sans supprimer les demandes existantes.</p>
    </>
  );
}
