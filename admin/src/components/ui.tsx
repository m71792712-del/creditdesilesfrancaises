'use client';

import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { STATUS_LABELS, type ActionState } from '@/lib/types';

export function SubmitButton({ children, className = 'btn btn-primary', pendingText = 'Patientez…' }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">{state.ok}</p>;
  return null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-sky-100 text-sky-800',
  under_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  merged: 'bg-violet-100 text-violet-800',
};
const EXTRA_LABELS: Record<string, string> = { merged: 'Fusionnée' };

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? EXTRA_LABELS[status] ?? status;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700'}`}>{label}</span>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">{text}</p>;
}

export function Pagination({ page, total, pageSize, basePath, params }: { page: number; total: number; pageSize: number; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && sp.set(k, v));
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? <Link className="btn btn-outline btn-sm" href={href(page - 1)}>← Précédent</Link> : <span />}
      <span className="text-slate-600">Page {page} / {pages} · {total} résultat{total > 1 ? 's' : ''}</span>
      {page < pages ? <Link className="btn btn-outline btn-sm" href={href(page + 1)}>Suivant →</Link> : <span />}
    </nav>
  );
}
