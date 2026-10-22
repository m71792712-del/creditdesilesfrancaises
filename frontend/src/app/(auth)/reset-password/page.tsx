import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/AuthCard';
import { ResetPasswordForm } from '@/components/auth/AuthForms';
import { requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Nouveau mot de passe' };

export default async function ResetPasswordPage() {
  const { t } = await getT();
  await requireUser(); // la session de récupération est créée par /auth/callback
  return (
    <AuthCard title={t('auth.reset.title')}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
