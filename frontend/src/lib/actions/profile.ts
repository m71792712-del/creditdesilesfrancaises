'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n';
import { formString } from '@/lib/utils';
import { profileSchema } from '@/lib/validations/auth';
import { zodFieldErrors } from '@/lib/validations/common';
import { getActionContext } from './context';
import type { ActionState } from './types';

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getT();
  const ctx = await getActionContext();
  if (!ctx) return { ok: false, message: t('err.not_authenticated') };

  const values = {
    lastName: formString(formData, 'lastName'),
    firstName: formString(formData, 'firstName'),
    phone: formString(formData, 'phone'),
    demoColor: formString(formData, 'demoColor'),
    demoCity: formString(formData, 'demoCity'),
    demoDigit: formString(formData, 'demoDigit'),
  };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error, t), values };
  const d = parsed.data;

  // Seules ces colonnes sont modifiables (droits de colonne + trigger + RLS côté base).
  const { error } = await ctx.supabase
    .from('profiles')
    .update({
      first_name: d.firstName,
      last_name: d.lastName,
      phone: d.phone,
      demo_color: d.demoColor || null,
      demo_city: d.demoCity || null,
      demo_digit: d.demoDigit === '' ? null : Number(d.demoDigit),
    })
    .eq('id', ctx.user.id);
  if (error) return { ok: false, message: t('err.generic'), values };
  revalidatePath('/', 'layout');
  return { ok: true, message: t('profile.updated'), values };
}

export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getT();
  const ctx = await getActionContext();
  if (!ctx) return { ok: false, message: t('err.not_authenticated') };

  const typed = formString(formData, 'confirmEmail').trim().toLowerCase();
  if (!ctx.user.email || typed !== ctx.user.email.toLowerCase()) {
    return { ok: false, fieldErrors: { confirmEmail: t('v.confirmEmail') } };
  }
  const { error } = await ctx.supabase.rpc('delete_my_account');
  if (error) return { ok: false, message: t('profile.delete.failed') };
  await ctx.supabase.auth.signOut();
  redirect('/');
}
