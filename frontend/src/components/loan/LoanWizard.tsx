'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Banknote, Check, CircleX, FileText, Hash, Landmark, Loader2, CalendarDays, Palette, CreditCard, Tag, TriangleAlert, Coins } from 'lucide-react';
import { submitLoanRequest } from '@/lib/actions/loan';
import { SIMULATION } from '@/lib/config';
import { CURRENCIES, OTHER_PURPOSE } from '@/lib/constants/statuses';
import { useI18n } from '@/lib/i18n/provider';
import { purposeLabel } from '@/lib/i18n/shared';
import { progressAt } from '@/lib/simulation/progress';
import { formatMoney } from '@/lib/utils';
import { LOAN_STEP_FIELDS, validateLoanStep, type Limits, type LoanFormValues } from '@/lib/validations/loan';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import type { Bank, CardType, Purpose } from '@/types/db';
import { BankPicker } from './BankPicker';

interface Props {
  banks: Bank[];
  purposes: Purpose[];
  cardTypes: CardType[];
  limits: Limits;
}

const STEPS = 5;
const VERIFY_MS = 8000;

export function LoanWizard({ banks, purposes, cardTypes, limits }: Props) {
  const { t, locale } = useI18n();
  const initial: LoanFormValues = {
    amount: '', currency: 'EUR', description: '', purposeCode: '', purposeDetails: '',
    bankId: '', otherBankName: '', cardTypeId: '',
    demoColor: '', demoDigit: '', demoYear: '', // vérification pédagogique : toujours vide au départ (distincte du profil)
  };
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<LoanFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [phase, setPhase] = useState<'form' | 'processing' | 'result'>('form');
  const [loanId, setLoanId] = useState('');
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (step > 0 || phase !== 'form') headingRef.current?.focus();
  }, [step, phase]);

  const update = (partial: Partial<LoanFormValues>) => {
    setValues((v) => ({ ...v, ...partial }));
    setErrors((e) => {
      const rest = { ...e };
      for (const k of Object.keys(partial)) delete rest[k];
      return rest;
    });
  };
  const translate = (keys: Record<string, string>) => Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, t(v, { min: limits.min.toLocaleString(locale), max: limits.max.toLocaleString(locale) })]));

  const goNext = () => {
    const found = validateLoanStep(step, values, limits);
    if (Object.keys(found).length) return setErrors(translate(found));
    setErrors({});
    setStep((s) => s + 1);
  };

  const submit = () => {
    for (let i = 0; i < STEPS - 1; i++) {
      const found = validateLoanStep(i, values, limits);
      if (Object.keys(found).length) {
        setStep(i);
        return setErrors(translate(found));
      }
    }
    setServerError('');
    startTransition(async () => {
      const res = await submitLoanRequest(values); // la validation est refaite côté serveur, puis par la base
      if (res.ok) {
        setLoanId(res.id);
        return setPhase('processing');
      }
      setServerError(res.message);
      const fe = res.fieldErrors;
      if (fe) {
        setErrors(fe);
        const idx = LOAN_STEP_FIELDS.findIndex((fields) => fields.some((f) => f in fe));
        if (idx >= 0) setStep(idx);
      }
    });
  };

  if (phase === 'processing') return <Processing onDone={() => setPhase('result')} />;
  if (phase === 'result') {
    return (
      <div className="card space-y-4 text-center" role="status">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-500"><CircleX className="h-8 w-8" aria-hidden /></span>
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-red-700 focus:outline-none">{t('proc.rejected.title')}</h2>
        <p className="text-slate-700">{t('proc.rejected.text')}</p>
        <p className="text-sm font-semibold text-amber-800">{t('proc.rejected.notReal')}</p>
        <p className="text-sm text-emerald-700">{t('proc.saved')}</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link href={`/dashboard/requests/${loanId}`} className="btn btn-primary">{t('proc.detail')}</Link>
          <button type="button" className="btn btn-outline" onClick={() => { setValues(initial); setStep(0); setErrors({}); setPhase('form'); }}>{t('proc.new')}</button>
        </div>
      </div>
    );
  }

  const purpose = purposes.find((p) => p.code === values.purposeCode);
  const bank = banks.find((b) => b.id === values.bankId);
  const card = cardTypes.find((c) => c.id === values.cardTypeId);
  const hint = { min: limits.min.toLocaleString(locale), max: limits.max.toLocaleString(locale) };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (step < STEPS - 1) goNext();
        else submit();
      }}
      className="space-y-5"
    >
      <ol className="grid grid-cols-5 gap-1 text-center text-[11px] sm:text-sm" aria-label={t('apply.title')}>
        {Array.from({ length: STEPS }, (_, i) => (
          <li key={i} aria-current={i === step ? 'step' : undefined} className="flex flex-col items-center gap-1">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${i < step ? 'bg-lagoon-500 text-white' : i === step ? 'bg-ocean-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {i < step ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
            </span>
            <span className={i === step ? 'font-semibold text-navy-900' : 'text-slate-500'}>{t(`apply.s${i + 1}`)}</span>
          </li>
        ))}
      </ol>

      <div className="card space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none">{t(`apply.t${step + 1}`)}</h2>
          <span className="text-sm text-slate-500">{t('apply.stepOf', { current: step + 1, total: STEPS })}</span>
        </div>

        {serverError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{serverError}</p>}

        {step === 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <TextField name="amount" type="number" inputMode="decimal" step="0.01" min={0} label={t('apply.amount')} hint={t('apply.amount.hint', hint)} required value={values.amount} onChange={(e) => update({ amount: e.target.value })} error={errors.amount} />
              <SelectField label={t('apply.currency')} value={values.currency} onChange={(e) => update({ currency: e.target.value })} error={errors.currency}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </SelectField>
            </div>
            <div>
              <label htmlFor="description" className="label">{t('apply.description')} <span aria-hidden className="text-red-600">*</span></label>
              <textarea
                id="description"
                rows={5}
                maxLength={2000}
                value={values.description}
                placeholder={t('apply.description.ph')}
                onChange={(e) => update({ description: e.target.value })}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={errors.description ? 'description-error' : 'description-hint'}
                className={`input ${errors.description ? 'border-red-500' : ''}`}
              />
              <p id="description-hint" className="mt-1.5 text-xs text-slate-500">{t('apply.description.hint')}</p>
              {errors.description && <p id="description-error" role="alert" className="field-error">{errors.description}</p>}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <SelectField
              label={t('apply.purpose')}
              required
              value={values.purposeCode}
              onChange={(e) => update({ purposeCode: e.target.value, ...(e.target.value === OTHER_PURPOSE ? {} : { purposeDetails: '' }) })}
              error={errors.purposeCode}
            >
              <option value="" disabled>{t('apply.purpose.ph')}</option>
              {purposes.map((p) => <option key={p.code} value={p.code}>{purposeLabel(p, locale)}</option>)}
            </SelectField>
            {values.purposeCode === OTHER_PURPOSE && (
              <TextField label={t('apply.purposeOther')} required maxLength={300} value={values.purposeDetails} onChange={(e) => update({ purposeDetails: e.target.value })} error={errors.purposeDetails} />
            )}
          </>
        )}

        {step === 2 && (
          <>
            <BankPicker
              banks={banks}
              value={values.bankId}
              onChange={(bankId) => update({ bankId, ...(bankId === 'other' ? {} : { otherBankName: '' }) })}
              otherName={values.otherBankName}
              onOtherName={(otherBankName) => update({ otherBankName })}
              error={errors.bankId}
              otherError={errors.otherBankName}
            />
            <SelectField label={`${t('apply.card')} (${t('common.optional')})`} value={values.cardTypeId} onChange={(e) => update({ cardTypeId: e.target.value })} error={errors.cardTypeId}>
              <option value="">{t('apply.card.none')}</option>
              {Array.from(new Set(cardTypes.map((c) => c.family))).map((family) => (
                <optgroup key={family} label={family}>
                  {cardTypes.filter((c) => c.family === family).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </SelectField>
          </>
        )}

        {step === 3 && <VerificationStep values={values} errors={errors} update={update} />}

        {step === 4 && (
          <>
            <dl className="divide-y divide-slate-100 text-sm">
              {[
                [Banknote, t('apply.amount'), formatMoney(Number(values.amount), values.currency, locale)],
                [Coins, t('apply.currency'), values.currency],
                [Tag, t('apply.purpose'), `${purpose ? purposeLabel(purpose, locale) : ''}${values.purposeCode === OTHER_PURPOSE ? ` — ${values.purposeDetails}` : ''}`],
                [FileText, t('apply.description'), values.description],
                [Landmark, t('req.bank'), bank ? bank.name : t('req.customBank', { name: values.otherBankName })],
                [CreditCard, t('apply.card'), card ? card.name : t('common.none')],
                [Palette, t('apply.demo.color'), values.demoColor],
                [Hash, t('apply.demo.digit'), values.demoDigit],
                [CalendarDays, t('apply.demo.year'), values.demoYear],
              ].map(([Icon, label, value]) => {
                const I = Icon as typeof Banknote;
                return (
                  <div key={label as string} className="flex items-start gap-3 py-3">
                    <I className="mt-0.5 h-5 w-5 shrink-0 text-ocean-600" aria-hidden />
                    <dt className="w-40 shrink-0 text-slate-500">{label as string}</dt>
                    <dd className="min-w-0 whitespace-pre-wrap break-words font-medium">{value as string}</dd>
                  </div>
                );
              })}
            </dl>
          </>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
          {step > 0 ? (
            <button type="button" className="btn btn-outline" onClick={() => { setErrors({}); setServerError(''); setStep((s) => s - 1); }}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> {t('common.previous')}
            </button>
          ) : <span />}
          {step < STEPS - 1 ? (
            <button type="submit" className="btn btn-green">{t('common.next')} <ArrowRight className="h-4 w-4" aria-hidden /></button>
          ) : (
            <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-green">
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {pending ? t('apply.submitting') : t('apply.submit')}
            </button>
          )}
        </div>
        {step === STEPS - 1 && (
          <p className="text-center text-xs text-slate-500">
            {t('apply.terms')} <Link href="/legal" target="_blank" className="underline">{t('auth.terms.link')}</Link>
          </p>
        )}
      </div>
    </form>
  );
}

/** Étape 4 : avertissement, champs fictifs et barre de vérification décorative (~8 s, non bloquante). */
function VerificationStep({ values, errors, update }: { values: LoanFormValues; errors: Record<string, string>; update: (p: Partial<LoanFormValues>) => void }) {
  const { t } = useI18n();
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const p = Math.min(100, Math.round(((performance.now() - start) / VERIFY_MS) * 100));
      setProgress(p);
      if (p >= 100) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <div role="note" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>{t('apply.demo.warning')}</p>
      </div>
      <TextField label={t('apply.demo.color')} icon={Palette} required maxLength={30} autoComplete="off" placeholder={t('ph.color')} value={values.demoColor} onChange={(e) => update({ demoColor: e.target.value })} error={errors.demoColor} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label={t('apply.demo.digit')} required value={values.demoDigit} onChange={(e) => update({ demoDigit: e.target.value })} error={errors.demoDigit}>
          <option value="" disabled>{t('apply.demo.digit.ph')}</option>
          {Array.from({ length: 10 }, (_, i) => <option key={i} value={String(i)}>{i}</option>)}
        </SelectField>
        <TextField label={t('apply.demo.year')} icon={CalendarDays} required inputMode="numeric" maxLength={4} autoComplete="off" placeholder={t('ph.year')} value={values.demoYear} onChange={(e) => update({ demoYear: e.target.value.replace(/\D/g, '') })} error={errors.demoYear} />
      </div>
      <div>
        <div className="mb-1 flex justify-between text-sm font-medium text-slate-700"><span>{t('apply.demo.progress')}</span><span aria-hidden>{progress}%</span></div>
        <div role="progressbar" aria-label={t('apply.demo.progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-3 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-lagoon-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">{t('apply.demo.eta')}</p>
      </div>
    </>
  );
}

/** Traitement simulé : 1 % -> 81 % puis plus lentement -> 94 % en ~8 s. Purement visuel (le statut réel reste « pending »). */
function Processing({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState<number>(SIMULATION.start);
  const doneRef = useRef(false);
  const cb = useRef(onDone);
  cb.current = onDone;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const next = Math.round(progressAt(elapsed));
      setValue((p) => (p === next ? p : next));
      if (elapsed >= SIMULATION.totalMs) {
        if (!doneRef.current) {
          doneRef.current = true;
          cb.current();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="card space-y-3 text-center">
      <h2 className="text-xl font-semibold">{t('proc.title')}</h2>
      <div role="progressbar" aria-label={t('proc.label')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <ProgressRing value={value} />
      </div>
      <p aria-live="polite" className="font-medium text-navy-900">{t('proc.analysing')}</p>
      <p className="text-sm text-slate-500">{t('proc.wait')}</p>
    </div>
  );
}v