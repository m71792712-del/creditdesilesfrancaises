import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AuthCard } from '@/components/auth/AuthCard';
import { ForgotPasswordForm } from '@/components/auth/AuthForms';
import { getT } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default async function ForgotPasswordPage() {
  const { t } = await getT();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <AuthCard title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      <ForgotPasswordForm nonce={nonce} />
    </AuthCard>
  );
}
