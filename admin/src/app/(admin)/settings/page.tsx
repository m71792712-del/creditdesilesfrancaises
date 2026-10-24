import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SettingForm } from '@/components/Forms';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Réglages' };

const FIELDS = [
  { key: 'loan_min_amount', label: 'Montant minimum d’une demande', hint: 'En euros (valeur de la base ; défaut 500).' },
  { key: 'loan_max_amount', label: 'Montant maximum d’une demande', hint: 'En euros (défaut 100 000).' },
  { key: 'loans_per_hour', label: 'Demandes autorisées par heure et par utilisateur', hint: 'Entier de 1 à 100 (défaut 5).' },
  { key: 'suggestions_per_day', label: 'Nouvelles banques suggérées par jour et par utilisateur', hint: 'Entier de 1 à 50.' },
];

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('key,value');
  const map = new Map<string, unknown>((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const mfa = map.get('require_admin_mfa') === true;

  return (
    <>
      <PageHeader title="Réglages" subtitle="Paramètres validés et audités par la base de données" />
      <div className="grid max-w-3xl gap-5">
        {FIELDS.map((f) => (
          <section key={f.key} className="card">
            <SettingForm settingKey={f.key} label={f.label} hint={f.hint} value={String(map.get(f.key) ?? '')} />
          </section>
        ))}
        <section className="card">
          <h2 className="text-sm font-medium text-slate-700">Double authentification obligatoire pour l’admin</h2>
          <p className="mt-1 text-sm">État actuel : <strong>{mfa ? 'activée' : 'désactivée'}</strong></p>
          <p className="mt-2 text-xs text-slate-500">Non modifiable ici : l’activer sans avoir enrôlé de TOTP vous bloquerait. Voir backend/docs/SECURITY.md.</p>
        </section>
      </div>
    </>
  );
}
