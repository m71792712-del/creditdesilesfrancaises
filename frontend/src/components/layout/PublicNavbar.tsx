import Link from 'next/link';
import { Menu } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';

export async function PublicNavbar() {
  const { t } = await getT();
  const user = await getUser();
  const link = 'rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:text-ocean-600';
  const anchors = (
    <>
      <Link href="/" className={link}>{t('nav.home')}</Link>
      <a href="/#about" className={link}>{t('nav.about')}</a>
      <a href="/#benefits" className={link}>{t('nav.benefits')}</a>
      <a href="/#faq" className={link}>{t('nav.faq')}</a>
    </>
  );
  const actions = user ? (
    <Link href="/dashboard" className="btn btn-primary btn-sm">{t('nav.dashboard')}</Link>
  ) : (
    <>
      <Link href="/login" className="btn btn-primary btn-sm">{t('nav.login')}</Link>
      <Link href="/register" className="btn btn-green btn-sm">{t('nav.register')}</Link>
    </>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/95 backdrop-blur">
      <nav aria-label="Principal" className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
        <Logo />
        <div className="hidden items-center gap-1 lg:flex">{anchors}</div>
        <div className="hidden items-center gap-2 lg:flex">
          <LanguageSwitcher />
          {actions}
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher />
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center rounded-lg border border-slate-300 p-2" aria-label={t('nav.menu')}>
              <Menu className="h-5 w-5" aria-hidden />
            </summary>
            <div className="absolute right-0 mt-2 flex w-60 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-soft">
              {anchors}
              <div className="mt-1 flex flex-col gap-2 border-t border-slate-100 pt-2">{actions}</div>
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
