'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FilePlus2, FileText, LayoutDashboard, UserRound } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';

const ITEMS = [
  { href: '/dashboard', key: 'shell.dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/requests', key: 'shell.requests', icon: FileText, exact: false },
  { href: '/apply', key: 'shell.apply', icon: FilePlus2, exact: false },
  { href: '/profile', key: 'shell.profile', icon: UserRound, exact: false },
];

export function SidebarNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <nav aria-label="Espace utilisateur" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ITEMS.map(({ href, key, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition ${active ? 'bg-lagoon-600 text-white' : 'text-slate-200 hover:bg-white/10'}`}
          >
            <Icon className="h-4 w-4" aria-hidden /> {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
