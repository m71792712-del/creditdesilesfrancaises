import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { Logo } from '@/components/layout/Logo';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { logout } from '@/lib/actions/auth';
import { getProfile, requireUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { initials } from '@/lib/utils';

// Espace connecté : l'utilisateur est revérifié ici ET dans chaque page (le middleware n'est qu'une première barrière).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { t } = await getT();
  const user = await requireUser();
  const profile = await getProfile();
  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : (user.email ?? '');
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="bg-navy-900 p-3 text-white lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:p-5">
        <div className="mb-3 lg:mb-8"><Logo light size={44} href="/dashboard" /></div>
        <SidebarNav />
        <form action={logout} className="mt-3 lg:mt-auto lg:pt-6">
          <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10">
            <LogOut className="h-4 w-4" aria-hidden /> {t('shell.logout')}
          </button>
        </form>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 bg-white px-4 py-3 sm:px-8">
          <p className="font-semibold text-navy-900">{t('shell.title')}</p>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="flex items-center gap-2">
              <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-ocean-600 text-xs font-bold text-white">
                {profile ? initials(profile.first_name, profile.last_name) : '?'}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-navy-900">{fullName}</p>
                <p className="text-xs text-slate-500">{t('shell.role')}</p>
              </div>
            </div>
          </div>
        </header>
        <main id="main" className="px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
