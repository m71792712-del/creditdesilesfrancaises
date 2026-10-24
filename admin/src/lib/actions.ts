'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { backendMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { LOAN_STATUSES, type ActionState } from '@/lib/types';
import { formString, slugify, UUID_RE } from '@/lib/utils';

const GENERIC_LOGIN_ERROR = 'Identifiants invalides ou accès refusé.';

// --- Session -----------------------------------------------------------------------------------

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = formString(formData, 'email').toLowerCase();
  const password = typeof formData.get('password') === 'string' ? (formData.get('password') as string) : '';
  if (!email || !password || email.length > 254 || password.length > 200) return { error: GENERIC_LOGIN_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: GENERIC_LOGIN_ERROR };

  // Seul le compte admin entre ; tout autre compte est immédiatement déconnecté (même message : pas d'énumération).
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    await supabase.auth.signOut();
    return { error: GENERIC_LOGIN_ERROR };
  }
  redirect('/');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// --- Demandes de prêt ---------------------------------------------------------------------------

export async function updateStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const loanId = formString(formData, 'loanId');
  const status = formString(formData, 'status');
  const comment = formString(formData, 'comment');
  if (!UUID_RE.test(loanId)) return { error: 'Demande invalide.' };
  if (!(LOAN_STATUSES as readonly string[]).includes(status)) return { error: 'Choisissez un statut.' };
  if (comment.length < 3 || comment.length > 500) return { error: 'Le commentaire (obligatoire) doit contenir entre 3 et 500 caractères.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_update_loan_status', { p_loan_id: loanId, p_new_status: status, p_comment: comment });
  if (error) return { error: backendMessage(error.message) };
  revalidatePath(`/requests/${loanId}`);
  revalidatePath('/requests');
  revalidatePath('/');
  return { ok: 'Statut mis à jour. L’historique et le journal d’audit ont été complétés.' };
}

// --- Suggestions « Autre banque » ---------------------------------------------------------------

export async function moderateSuggestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = formString(formData, 'suggestionId');
  const action = formString(formData, 'action');
  if (!UUID_RE.test(id) || !['approve', 'reject', 'merge'].includes(action)) return { error: 'Requête invalide.' };

  let targetBankId: string | null = null;
  if (action === 'merge') {
    targetBankId = formString(formData, 'targetBankId');
    if (!UUID_RE.test(targetBankId)) return { error: 'Choisissez la banque existante vers laquelle fusionner.' };
  }
  const type = formString(formData, 'type') === 'fintech' ? 'fintech' : 'bank';
  const territory = formString(formData, 'territory').slice(0, 80);

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_moderate_bank_suggestion', {
    p_suggestion_id: id,
    p_action: action,
    p_target_bank_id: targetBankId,
    p_territory: action === 'approve' ? territory : '',
    p_type: action === 'approve' ? type : 'bank',
  });
  if (error) return { error: backendMessage(error.message) };
  revalidatePath('/suggestions');
  revalidatePath('/banks');
  revalidatePath('/');
  const done = { approve: 'Banque créée et demandes rattachées.', reject: 'Suggestion rejetée.', merge: 'Suggestion fusionnée.' } as const;
  return { ok: done[action as keyof typeof done] };
}

// --- Banques ------------------------------------------------------------------------------------

export async function addBankAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = formString(formData, 'name').replace(/\s+/g, ' ');
  const territory = formString(formData, 'territory').slice(0, 80);
  const type = formString(formData, 'type') === 'fintech' ? 'fintech' : 'bank';
  if (name.length < 2 || name.length > 120) return { error: 'Le nom doit contenir entre 2 et 120 caractères.' };
  const slug = slugify(name);
  if (!slug) return { error: 'Nom invalide.' };

  const supabase = await createClient();
  const { error } = await supabase.from('banks').insert({ name, slug, territory, type });
  if (error) {
    return { error: error.code === '23505' ? 'Une banque portant ce nom existe déjà.' : 'Impossible d’ajouter la banque.' };
  }
  revalidatePath('/banks');
  return { ok: 'Banque ajoutée.' };
}

export async function toggleBankAction(formData: FormData) {
  await requireAdmin();
  const id = formString(formData, 'bankId');
  const active = formString(formData, 'active') === 'true';
  if (!UUID_RE.test(id)) return;
  const supabase = await createClient();
  await supabase.from('banks').update({ is_active: active }).eq('id', id);
  revalidatePath('/banks');
}

// --- Réglages -----------------------------------------------------------------------------------

const NUMERIC_SETTINGS: Record<string, { min: number; max: number; int: boolean }> = {
  loan_min_amount: { min: 1, max: 10_000_000, int: false },
  loan_max_amount: { min: 1, max: 10_000_000, int: false },
  loans_per_hour: { min: 1, max: 100, int: true },
  suggestions_per_day: { min: 1, max: 50, int: true },
};

export async function updateSettingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const key = formString(formData, 'key');
  const rule = NUMERIC_SETTINGS[key];
  if (!rule) return { error: 'Réglage inconnu.' };
  const value = Number(formString(formData, 'value').replace(',', '.'));
  if (!Number.isFinite(value) || value < rule.min || value > rule.max || (rule.int && !Number.isInteger(value))) {
    return { error: `Valeur invalide (entre ${rule.min} et ${rule.max}${rule.int ? ', entier' : ''}).` };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_update_setting', { p_key: key, p_value: value });
  if (error) return { error: backendMessage(error.message) };
  revalidatePath('/settings');
  return { ok: 'Réglage enregistré.' };
}
