'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; icon?: LucideIcon };

export function TextField({ label, error, hint, icon: Icon, id, type = 'text', className = '', ...props }: Props) {
  const { t } = useI18n();
  const uid = useId();
  const inputId = id ?? uid;
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [error ? `${inputId}-error` : null, hint ? `${inputId}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={inputId} className="label">
        {label}
        {props.required && <span aria-hidden className="text-red-600"> *</span>}
      </label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />}
        <input
          id={inputId}
          type={isPassword && show ? 'text' : type}
          className={`input ${Icon ? 'pl-10' : ''} ${isPassword ? 'pr-11' : ''} ${error ? 'border-red-500' : ''} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t('auth.hide') : t('auth.show')}
            aria-pressed={show}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:text-slate-800"
          >
            {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        )}
      </div>
      {hint && <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${inputId}-error`} role="alert" className="field-error">{error}</p>}
    </div>
  );
}
