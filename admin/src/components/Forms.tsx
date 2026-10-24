'use client';

import { useActionState } from 'react';
import { addBankAction, loginAction, moderateSuggestionAction, updateSettingAction, updateStatusAction } from '@/lib/actions';
import { LOAN_STATUSES, STATUS_LABELS, type ActionState } from '@/lib/types';
import { FormMessage, SubmitButton } from '@/components/ui';

export function LoginForm({ denied }: { denied: boolean }) {
  const [state, action] = useActionState(loginAction, null as ActionState);
  return (
    <form action={action} className="space-y-4" noValidate>
      {denied && !state && <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">Accès réservé à l’administrateur.</p>}
      <FormMessage state={state} />
      <div>
        <label htmlFor="email" className="label">Adresse e-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={200} className="input" />
      </div>
      <SubmitButton className="btn btn-primary w-full" pendingText="Connexion…">Se connecter</SubmitButton>
    </form>
  );
}

export function StatusForm({ loanId, current }: { loanId: string; current: string }) {
  const [state, action] = useActionState(updateStatusAction, null as ActionState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="loanId" value={loanId} />
      <FormMessage state={state} />
      <div>
        <label htmlFor="status" className="label">Nouveau statut</label>
        <select id="status" name="status" required defaultValue="" className="input">
          <option value="" disabled>Choisir…</option>
          {LOAN_STATUSES.filter((s) => s !== current).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="comment" className="label">Commentaire (obligatoire, visible dans l’historique)</label>
        <textarea id="comment" name="comment" required minLength={3} maxLength={500} rows={3} className="input" placeholder="Ex. : dossier examiné, pièces cohérentes…" />
      </div>
      <SubmitButton>Enregistrer le statut</SubmitButton>
    </form>
  );
}

export function SuggestionActions({ suggestionId, banks }: { suggestionId: string; banks: { id: string; name: string }[] }) {
  const [state, action] = useActionState(moderateSuggestionAction, null as ActionState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="suggestionId" value={suggestionId} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`t-${suggestionId}`}>Territoire (si approuvée)</label>
          <input id={`t-${suggestionId}`} name="territory" maxLength={80} className="input" placeholder="Ex. : Martinique" />
        </div>
        <div>
          <label className="label" htmlFor={`ty-${suggestionId}`}>Type (si approuvée)</label>
          <select id={`ty-${suggestionId}`} name="type" className="input" defaultValue="bank">
            <option value="bank">Banque</option>
            <option value="fintech">Fintech</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`m-${suggestionId}`}>Fusionner avec (si fusion)</label>
          <select id={`m-${suggestionId}`} name="targetBankId" className="input" defaultValue="">
            <option value="">—</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button name="action" value="approve" className="btn btn-green btn-sm">Approuver (créer la banque)</button>
        <button name="action" value="merge" className="btn btn-outline btn-sm">Fusionner</button>
        <button name="action" value="reject" className="btn btn-danger btn-sm">Rejeter</button>
      </div>
    </form>
  );
}

export function AddBankForm() {
  const [state, action] = useActionState(addBankAction, null as ActionState);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="bank-name">Nom</label>
          <input id="bank-name" name="name" required minLength={2} maxLength={120} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="bank-territory">Territoire</label>
          <input id="bank-territory" name="territory" maxLength={80} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="bank-type">Type</label>
          <select id="bank-type" name="type" className="input" defaultValue="bank">
            <option value="bank">Banque</option>
            <option value="fintech">Fintech</option>
          </select>
        </div>
      </div>
      <SubmitButton>Ajouter la banque</SubmitButton>
    </form>
  );
}

export function SettingForm({ settingKey, label, hint, value }: { settingKey: string; label: string; hint: string; value: string }) {
  const [state, action] = useActionState(updateSettingAction, null as ActionState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="key" value={settingKey} />
      <label className="label" htmlFor={`s-${settingKey}`}>{label}</label>
      <div className="flex gap-2">
        <input id={`s-${settingKey}`} name="value" defaultValue={value} inputMode="decimal" required className="input max-w-[12rem]" />
        <SubmitButton className="btn btn-primary btn-sm">Enregistrer</SubmitButton>
      </div>
      <p className="text-xs text-slate-500">{hint}</p>
      <FormMessage state={state} />
    </form>
  );
}
