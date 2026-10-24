import type { Metadata } from 'next';
import { DeleteAccountForm, ProfileForm } from '@/components/profile/ProfileForms';
import { getProfile, requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Mon profil' };

export default async function ProfilePage() {
  const { t, locale } = await getT();
  await requireUser();
  const profile = await getProfile();
  if (!profile) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
        <p className="mt-1 text-slate-600">{t('profile.subtitle')}</p>
      </div>
      <section className="card space-y-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-slate-500">{t('profile.role')}</dt><dd className="font-medium">{t('shell.role')}</dd></div>
          <div><dt className="text-slate-500">{t('profile.member')}</dt><dd className="font-medium">{formatDate(profile.created_at, locale)}</dd></div>
        </dl>
        <ProfileForm profile={profile} />
      </section>
      
    </div>
  );
}
