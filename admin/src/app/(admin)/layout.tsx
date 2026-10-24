import type { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { requireAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="flex flex-col md:flex-row">
      <Sidebar adminName={`${admin.first_name} ${admin.last_name} · ${admin.email}`} />
      <main id="main" className="min-w-0 flex-1 p-4 sm:p-8">{children}</main>
    </div>
  );
}
