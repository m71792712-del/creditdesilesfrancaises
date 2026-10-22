import Link from 'next/link';
import { getT } from '@/lib/i18n';

export default async function NotFound() {
  const { t } = await getT();
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="text-6xl font-bold text-ocean-600">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t('error.notFound.title')}</h1>
      <p className="mt-2 text-slate-600">{t('error.notFound.text')}</p>
      <Link href="/" className="btn btn-primary mt-6">{t('error.home')}</Link>
    </main>
  );
}
