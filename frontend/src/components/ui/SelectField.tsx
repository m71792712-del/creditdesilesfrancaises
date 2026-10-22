'use client';

import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

type Props = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string; children: ReactNode; hideLabel?: boolean };

export function SelectField({ label, error, hint, id, children, hideLabel, className = '', ...props }: Props) {
  const uid = useId();
  const selectId = id ?? uid;
  const describedBy = [error ? `${selectId}-error` : null, hint ? `${selectId}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={selectId} className={hideLabel ? 'sr-only' : 'label'}>
        {label}
        {props.required && !hideLabel && <span aria-hidden className="text-red-600"> *</span>}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className={`input appearance-none pr-10 ${error ? 'border-red-500' : ''} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
      </div>
      {hint && <p id={`${selectId}-hint`} className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${selectId}-error`} role="alert" className="field-error">{error}</p>}
    </div>
  );
}
