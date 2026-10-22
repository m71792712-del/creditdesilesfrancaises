import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ActionState } from '@/lib/actions/types';

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.message) return null;
  return (
    <div
      role={state.ok ? 'status' : 'alert'}
      className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${state.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'}`}
    >
      {state.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <span>{state.message}</span>
    </div>
  );
}
