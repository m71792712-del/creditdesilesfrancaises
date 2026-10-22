'use server';

import { redirect } from 'next/navigation';
import { CAPTCHA_ENABLED, SITE_URL } from '@/lib/config';
import { getT } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { formString, safeNext } from '@/lib/utils';
import { forgotSchema, loginSchema, registerSchema, resetSchema } from '@/lib/validations/auth';
import { zodFieldErrors } from '@/lib/validations/common';
import { getActionContext } from './context';
import type { ActionState } from './types';

const captchaToken = (fd: FormData) => (CAPTCHA_ENABLED ? formString(fd, 'cf-turnstile-response') || undefined : undefined);

function authErrorMessage(err: { status?: number; message?: string; code?: string }, fallback: string, t: (k: string) => string) {
  if (err.status === 429) return t('auth.tooMany');
  if (/captcha/i.test(err.message ?? '') || /captcha/i.test(err.code ?? '')) return t('auth.captcha');
  return fallback;
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getT();
  const email = formString(formData, 'email');
  const parsed = loginSchema.safeParse({ email, password: formString(formData, 'password') });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error, t), values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ ...parsed.data, options: { captchaToken: captchaToken(formData) } });
  // Message générique : ne révèle jamais si l'e-mail existe.
  if (error) return { ok: false, message: authErrorMessage(error, t('auth.login.invalid'), t), values: { email } };
  redirect(safeNext(formString(formData, 'next')));
}

export async function register(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getT();
  const values = {
    lastName: formString(formData, 'lastName'),
    firstName: formString(formData, 'firstName'),
    phone: formString(formData, 'phone'),
    email: formString(formData, 'email'),
    demoColor: formString(formData, 'demoColor'),
    demoCity: formString(formData, 'demoCity'),
  };
  const parsed = registerSchema.safeParse({ ...values, password: formString(formData, 'password'), terms: formString(formData, 'terms') });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error, t), values };

  const supabase = await createClient();
  const d = parsed.data;
  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      data: { first_name: d.firstName, last_name: d.lastName, phone: d.phone, demo_color: d.demoColor, demo_city: d.demoCity },
      emailRedirectTo: `${SITE_URL}/auth/callback?next=/dashboard`,
      captchaToken: captchaToken(formData),
    },
  });
  if (error) {
    const weak = error.code === 'weak_password' ? t('auth.register.weak') : t('auth.register.failed');
    return { ok: false, message: authErrorMessage(error, weak, t), values };
  }
  if (data.session) redirect('/dashboard'); // confirmation e-mail désactivée (démonstration)
  return { ok: true, message: t('auth.register.checkEmail') };
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function forgotPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getT();
  const email = formString(formData, 'email');
  const parsed = forgotSchema.safeParse({ email });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error, t), values: { email } };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/reset-password`,
    captchaToken: captchaToken(formData),
  });
  return { ok: true, message: t('auth.forgot.sent') }; // même réponse que le compte existe ou non
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getT();
  const parsed = resetSchema.safeParse({ password: formString(formData, 'password') });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error, t) };
  const ctx = await getActionContext();
  if (!ctx) return { ok: false, message: t('auth.reset.failed') };
  const { error } = await ctx.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: t('auth.reset.failed') };
  return { ok: true, message: t('auth.reset.success') };
}
