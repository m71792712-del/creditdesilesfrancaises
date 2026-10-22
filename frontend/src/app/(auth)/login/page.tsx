import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/AuthForms';
import { getUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { one, safeNext } from '@/lib/utils';

export const metadata: Metadata = { title: 'Connexion' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getT();
  const sp = await searchParams;
  if (await getUser()) redirect('/dashboard');
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const next = safeNext(one(sp.next), '');
  return (
    <AuthCard title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      {one(sp.error) === 'callback' && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{t('auth.callbackError')}</p>}
      <LoginForm next={next || undefined} nonce={nonce} />
    </AuthCard>
  );
}
