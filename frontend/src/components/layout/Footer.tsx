import Link from 'next/link';
import { Accessibility, Flower, ShieldCheck, Zap, Compass } from 'lucide-react';
import { getT } from '@/lib/i18n';
import { Logo } from './Logo';

export async function Footer() {
  const { t } = await getT();
  const items = [
    { icon: Zap, label: t('footer.fast') },
    { icon: ShieldCheck, label: t('footer.secure') },
    { icon: Accessibility, label: t('footer.accessible') },
    { icon: Compass, label: t('footer.support') },
  ];
  return (
    <footer className="mt-16 bg-navy-900 text-slate-200">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <Logo light size={48} />
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {items.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2"><Icon className="h-4 w-4 text-lagoon-400" aria-hidden />{label}</li>
            ))}
          </ul>
          <p className="flex items-center gap-2 font-script text-xl text-white">
            {t('brand.slogan')} <Flower className="h-6 w-6 text-red-400" aria-hidden />
          </p>
        </div>
        <div className="space-y-2 border-t border-white/15 pt-4 text-xs text-slate-300">
          <p>{t('footer.banksNote')}</p>
          <p>{t('footer.legal')}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>
            <Link href="/legal" className="underline hover:text-white">{t('footer.legalLink')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
