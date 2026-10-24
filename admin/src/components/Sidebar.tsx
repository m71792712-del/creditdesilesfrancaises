'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Building2, ClipboardList, LayoutDashboard, LogOut, ScrollText, Settings, ShieldCheck, Users, Lightbulb } from 'lucide-react';
import { logoutAction } from '@/lib/actions';

const LINKS = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/requests', label: 'Demandes de prêt', icon: ClipboardList },
  { href: '/suggestions', label: 'Suggestions de banques', icon: Lightbulb },
  { href: '/banks', label: 'Banques', icon: Building2 },
  { href: '/users', label: 'Utilisateurs', icon: Users },
  { href: '/audit', label: 'Journal d’audit', icon: ScrollText },
  { href: '/settings', label: 'Réglages', icon: Settings },
];

export function Sidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <aside className="flex w-full shrink-0 flex-col bg-navy-900 text-white md:min-h-screen md:w-64">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Image src="/images/logo-icon.png" alt="" width={36} height={36} className="rounded-full" />
        <div className="leading-tight">
          <p className="text-sm font-bold">Crédit des îles françaises</p>
          <p className="flex items-center gap-1 text-xs text-lagoon-400"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Administration</p>
        </div>
      </div>
      <nav aria-label="Navigation admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive(href) ? 'bg-white/15 text-white' : 'text-navy-100 hover:bg-white/10'}`}
          >
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 px-5 py-4">
        <p className="mb-2 truncate text-xs text-navy-200">{adminName}</p>
        <form action={logoutAction}>
          <button type="submit" className="flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white">
            <LogOut className="h-4 w-4" aria-hidden /> Se déconnecter
          </button>
        </form>
      </div>
    </aside>
  );
}
