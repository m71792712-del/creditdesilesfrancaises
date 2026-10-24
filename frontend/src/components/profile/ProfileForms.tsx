'use client';

import { useActionState } from 'react';
import { MapPin, Palette, Phone, User } from 'lucide-react';
import { deleteAccount, updateProfile } from '@/lib/actions/profile';
import { useI18n } from '@/lib/i18n/provider';
import { FormMessage } from '@/components/ui/FormMessage';
import { SelectField } from '@/components/ui/SelectField';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import type { Profile } from '@/types/db';

export function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const [state, action] = useActionState(updateProfile, null);
  const e = state?.fieldErrors;
  const v = state?.values;
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="lastName" icon={User} label={t('auth.lastName')} required minLength={2} maxLength={60} defaultValue={v?.lastName ?? profile.last_name} error={e?.lastName} />
        <TextField name="firstName" icon={User} label={t('auth.firstName')} required minLength={2} maxLength={60} defaultValue={v?.firstName ?? profile.first_name} error={e?.firstName} />
      </div>
      <TextField name="phone" type="tel" icon={Phone} label={t('auth.phone')} required maxLength={20} defaultValue={v?.phone ?? profile.phone ?? ''} error={e?.phone} />
      <TextField name="email" type="email" label={t('auth.email')} value={profile.email} readOnly disabled />
      <fieldset className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <legend className="px-1 text-sm font-semibold text-amber-900">{t('profile.demoTitle')}</legend>
        <TextField name="demoColor" label={t('auth.demoColor')} maxLength={30} defaultValue={v?.demoColor ?? profile.demo_color ?? ''} error={e?.demoColor} />
        <TextField name="demoCity" icon={MapPin} label={t('auth.demoCity')} maxLength={60} defaultValue={v?.demoCity ?? profile.demo_city ?? ''} error={e?.demoCity} />
        <SelectField name="demoDigit" label={t('apply.demo.digit')} defaultValue={v?.demoDigit ?? (profile.demo_digit == null ? '' : String(profile.demo_digit))} error={e?.demoDigit}>
          <option value="">{t('apply.demo.digit.ph')}</option>
          {Array.from({ length: 10 }, (_, i) => <option key={i} value={String(i)}>{i}</option>)}
        </SelectField>
      </fieldset>
      <SubmitButton className="btn btn-primary">{t('common.save')}</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(deleteAccount, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <p className="text-sm text-slate-700">{t('profile.delete.text')}</p>
      <TextField name="confirmEmail" type="email" label={t('profile.delete.confirm')} autoComplete="off" required error={state?.fieldErrors?.confirmEmail} />
      <SubmitButton className="btn btn-danger">{t('profile.delete.button')}</SubmitButton>
    </form>
  );
}
