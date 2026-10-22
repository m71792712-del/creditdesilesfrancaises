import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronDown, Compass, FileText, Search, ShieldCheck, UserPlus, Zap, Accessibility, Eye } from 'lucide-react';
import { getT } from '@/lib/i18n';

export default async function HomePage() {
  const { t } = await getT();
  const benefits = [
    { icon: Zap, key: 'fast' },
    { icon: ShieldCheck, key: 'secure' },
    { icon: Accessibility, key: 'accessible' },
    { icon: Compass, key: 'support' },
  ];
  const steps = [
    { icon: UserPlus, n: 1 },
    { icon: FileText, n: 2 },
    { icon: Search, n: 3 },
    { icon: Eye, n: 4 },
  ];
  return (
    <>
      {/* Hero : la photo contient déjà le logo et le slogan → titre visible uniquement pour les lecteurs d'écran */}
      <section className="relative isolate h-[520px] overflow-hidden sm:h-[600px] lg:h-[660px]">
        <Image
          src="/images/hero-1536.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          quality={80}
          className="-z-10 object-cover object-[28%_50%] md:object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950/70 via-navy-950/10 to-transparent" aria-hidden />
        <h1 className="sr-only">{t('home.h1')}</h1>
        <div className="mx-auto flex h-full max-w-7xl items-end px-4 pb-16 sm:pb-20">
          <div className="max-w-xl rounded-2xl bg-navy-900/80 p-5 text-white shadow-soft backdrop-blur-sm sm:p-6">
            <p className="text-sm leading-relaxed sm:text-base">{t('home.subtitle')}</p>
            <Link href="/apply" className="btn btn-green mt-4 px-6 py-3 text-base">
              {t('home.cta')} <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section id="benefits" aria-label={t('benefits.title')} className="relative z-10 mx-auto -mt-10 max-w-6xl px-4">
        <ul className="grid gap-4 rounded-2xl border border-sky-100 bg-white p-5 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-50 text-ocean-600"><Icon className="h-5 w-5" aria-hidden /></span>
              <div>
                <p className="font-semibold text-navy-900">{t(`benefit.${key}.title`)}</p>
                <p className="text-sm text-slate-600">{t(`benefit.${key}.text`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="about" className="mx-auto mt-16 max-w-3xl scroll-mt-24 px-4 text-center">
        <h2 className="text-3xl font-bold">{t('about.title')}</h2>
        <p className="mt-4 text-slate-600">{t('about.text')}</p>
      </section>

      <section id="how" className="mx-auto mt-16 max-w-6xl scroll-mt-24 px-4">
        <h2 className="text-center text-3xl font-bold">{t('how.title')}</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, n }) => (
            <li key={n} className="card relative">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ocean-600 text-sm font-bold text-white">{n}</span>
                <Icon className="h-5 w-5 text-ocean-600" aria-hidden />
              </div>
              <h3 className="mt-3 font-semibold">{t(`how.${n}.title`)}</h3>
              <p className="text-sm text-slate-600">{t(`how.${n}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4">
        <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-sky-100 to-lagoon-100 p-5">
          <Image src="/images/logo-icon.png" alt="" width={56} height={56} className="rounded-full" />
          <p className="text-lg font-semibold text-navy-900">{t('band.text')}</p>
        </div>
      </section>

      <section id="faq" className="mx-auto mt-16 max-w-3xl scroll-mt-24 px-4">
        <h2 className="text-center text-3xl font-bold">{t('faq.title')}</h2>
        <div className="mt-8 space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <details key={n} className="card group p-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 font-medium marker:hidden">
                {t(`faq.${n}.q`)}
                <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" aria-hidden />
              </summary>
              <p className="px-6 pb-5 text-sm text-slate-600">{t(`faq.${n}.a`)}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
