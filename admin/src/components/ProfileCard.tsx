import { formatDate } from '@/lib/utils';
import type { ProfileInfo } from '@/lib/types';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-3">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="break-words text-sm text-slate-900 sm:col-span-2">{children}</dd>
    </div>
  );
}

/** Affiche TOUTES les informations saisies par l'utilisateur à son inscription. */
export function ProfileCard({ profile, role, updatedAt }: { profile: ProfileInfo; role?: string; updatedAt?: string }) {
  return (
    <>
      <dl className="divide-y divide-slate-100">
        <Row label="Prénom">{profile.first_name}</Row>
        <Row label="Nom">{profile.last_name}</Row>
        <Row label="E-mail">{profile.email}</Row>
        <Row label="Téléphone">{profile.phone || '—'}</Row>
        {role && <Row label="Rôle">{role === 'admin' ? 'Administrateur' : 'Utilisateur'}</Row>}
        <Row label="Inscrit le">{formatDate(profile.created_at)}</Row>
        {updatedAt && <Row label="Dernière modification">{formatDate(updatedAt)}</Row>}
      </dl>
      <h3 className="mb-1 mt-4 text-sm font-semibold text-slate-700">Saisi à l’inscription</h3>
      <dl className="divide-y divide-slate-100">
        <Row label="Pays">{profile.demo_color || '—'}</Row>
        <Row label="Ville">{profile.demo_city || '—'}</Row>
        
      </dl>
      <p className="mt-3 text-xs text-slate-500">Ces champs sont fictifs contiennent les imformations saisi à l'inscription.</p>
    </>
  );
}