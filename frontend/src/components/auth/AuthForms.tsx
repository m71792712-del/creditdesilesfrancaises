'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Lock, Mail, MapPin, Palette, Phone, User } from 'lucide-react';
import { forgotPassword, login, register, updatePassword } from '@/lib/actions/auth';
import { useI18n } from '@/lib/i18n/provider';
import { Captcha } from '@/components/ui/Captcha';
import { FormMessage } from '@/components/ui/FormMessage';
import { SelectField } from '@/components/ui/SelectField';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';

export function LoginForm({ next, nonce }: { next?: string; nonce?: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ''} />
      <FormMessage state={state} />
      <TextField name="email" type="email" icon={Mail} label={t('auth.email')} placeholder={t('ph.email')} autoComplete="email" required maxLength={254} defaultValue={state?.values?.email} error={state?.fieldErrors?.email} />
      <TextField name="password" type="password" icon={Lock} label={t('auth.password')} autoComplete="current-password" required maxLength={72} error={state?.fieldErrors?.password} />
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="text-ocean-600 hover:underline">{t('auth.login.forgot')}</Link>
      </div>
      <Captcha nonce={nonce} resetKey={state} />
      <SubmitButton className="btn btn-green w-full">{t('auth.login.submit')}</SubmitButton>
      <p className="text-center text-sm">
        {t('auth.login.noAccount')} <Link href="/register" className="font-medium text-ocean-600 hover:underline">{t('nav.register')}</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ nonce }: { nonce?: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(register, null);
  const e = state?.fieldErrors;
  const v = state?.values;
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <TextField name="lastName" icon={User} label={t('auth.lastName')} placeholder={t('ph.lastName')} autoComplete="family-name" required minLength={2} maxLength={60} defaultValue={v?.lastName} error={e?.lastName} />
      <TextField name="firstName" icon={User} label={t('auth.firstName')} placeholder={t('ph.firstName')} autoComplete="given-name" required minLength={2} maxLength={60} defaultValue={v?.firstName} error={e?.firstName} />
      <TextField name="phone" type="tel" icon={Phone} label={t('auth.phone')} placeholder={t('ph.phone')} autoComplete="tel" required maxLength={20} defaultValue={v?.phone} error={e?.phone} />
      <TextField name="email" type="email" icon={Mail} label={t('auth.email')} placeholder={t('ph.email')} autoComplete="email" required maxLength={254} defaultValue={v?.email} error={e?.email} />
      <TextField name="demoColor" label={t('auth.demoColor')} placeholder={t('ph.color')} autoComplete="off" required maxLength={30} defaultValue={v?.demoColor} error={e?.demoColor} />
      <TextField name="demoCity" icon={MapPin} label={t('auth.demoCity')} placeholder={t('ph.city')} autoComplete="off" required maxLength={60} defaultValue={v?.demoCity} error={e?.demoCity} />
        <SelectField name="demoDigit" label={t('apply.demo.digit')} required defaultValue={v?.demoDigit ?? ''} error={e?.demoDigit}>
        <option value="" disabled>{t('apply.demo.digit.ph')}</option>
        {Array.from({ length: 10 }, (_, i) => <option key={i} value={String(i)}>{i}</option>)}
      </SelectField>
      <TextField name="password" type="password" icon={Lock} label={t('auth.password')} autoComplete="new-password" required minLength={8} maxLength={72} hint={t('auth.password.hint')} error={e?.password} />
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="terms" required aria-invalid={e?.terms ? true : undefined} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-lagoon-600" />
          <span>
            {t('auth.terms')}{' '}
            <Link href="/legal" className="text-ocean-600 underline" target="_blank">{t('auth.terms.link')}</Link>
          </span>
        </label>
        {e?.terms && <p role="alert" className="field-error">{e.terms}</p>}
      </div>
      <Captcha nonce={nonce} resetKey={state} />
      <SubmitButton className="btn btn-green w-full">{t('auth.register.submit')}</SubmitButton>
      <p className="text-center text-sm">
        {t('auth.register.hasAccount')} <Link href="/login" className="font-medium text-ocean-600 hover:underline">{t('nav.login')}</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm({ nonce }: { nonce?: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(forgotPassword, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <TextField name="email" type="email" icon={Mail} label={t('auth.email')} placeholder={t('ph.email')} autoComplete="email" required maxLength={254} defaultValue={state?.values?.email} error={state?.fieldErrors?.email} />
      <Captcha nonce={nonce} resetKey={state} />
      <SubmitButton className="btn btn-primary w-full">{t('auth.forgot.submit')}</SubmitButton>
      <p className="text-center text-sm"><Link href="/login" className="text-ocean-600 hover:underline">{t('nav.login')}</Link></p>
    </form>
  );
}

export function ResetPasswordForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <TextField name="password" type="password" icon={Lock} label={t('auth.newPassword')} autoComplete="new-password" required minLength={8} maxLength={72} hint={t('auth.password.hint')} error={state?.fieldErrors?.password} />
      <SubmitButton className="btn btn-primary w-full">{t('auth.reset.submit')}</SubmitButton>
      {state?.ok && <p className="text-center text-sm"><Link href="/dashboard" className="font-medium text-ocean-600 hover:underline">{t('nav.dashboard')}</Link></p>}
    </form>
  );
}
