import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { RegisterForm } from '@/components/auth/AuthForms';
import { getUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Créer un compte' };

export default async function RegisterPage() {
  const { t } = await getT();
  if (await getUser()) redirect('/dashboard');
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <AuthCard title={t('auth.register.title')} subtitle={t('auth.register.subtitle')}>
      <RegisterForm nonce={nonce} />
    </AuthCard>
  );
}
