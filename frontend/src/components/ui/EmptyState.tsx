import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-sky-50 text-ocean-600"><Inbox className="h-6 w-6" aria-hidden /></span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="max-w-md text-sm text-slate-600">{text}</p>}
      {children}
    </div>
  );
}
