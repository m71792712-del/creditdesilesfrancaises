'use client';

import { useId, useMemo, useState } from 'react';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { useI18n } from '@/lib/i18n/provider';
import type { Bank } from '@/types/db';
import { BankLogo } from './BankLogo';

// Une banque sans territoire reste visible : elle est rangée sous « Non précisé ».
const FALLBACK_TERRITORY = 'Non précisé';
const territoryOf = (b: Bank) => b.territory || FALLBACK_TERRITORY;

interface Props {
  banks: Bank[];
  value: string;
  onChange: (id: string) => void;
  otherName: string;
  onOtherName: (name: string) => void;
  error?: string;
  otherError?: string;
}

/** Grille de banques : choix du pays / territoire, option « Autre banque ». Boutons radio natifs (clavier + lecteur d'écran). */
export function BankPicker({ banks, value, onChange, otherName, onOtherName, error, otherError }: Props) {
  const { t } = useI18n();
  const uid = useId();

  const territories = useMemo(() => Array.from(new Set(banks.map(territoryOf))).sort((a, b) => a.localeCompare(b)), [banks]);
  // Pas d'option « Tous » : un territoire est toujours sélectionné (le premier de la liste par défaut).
  const [territory, setTerritory] = useState(() => territories[0] ?? '');
  const filtered = useMemo(() => banks.filter((b) => !territory || territoryOf(b) === territory), [banks, territory]);
  const selected = banks.find((b) => b.id === value);

  const tile = (checked: boolean) =>
    `flex h-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition peer-focus-visible:ring-2 peer-focus-visible:ring-ocean-500 ${checked ? 'border-lagoon-500 bg-lagoon-50 ring-1 ring-lagoon-500' : 'border-slate-200 bg-white hover:border-sky-300'}`;

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <SelectField label={t('apply.bank.territory')} value={territory} onChange={(e) => setTerritory(e.target.value)}>
          {territories.map((x) => <option key={x} value={x}>{x}</option>)}
        </SelectField>
      </div>

      <fieldset aria-describedby={error ? `${uid}-error` : undefined}>
        <legend className="sr-only">{t('apply.t3')}</legend>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <li key={b.id}>
              <label className="relative block h-full">
                <input type="radio" name="bank" value={b.id} checked={value === b.id} onChange={() => onChange(b.id)} className="peer sr-only" />
                <span className={tile(value === b.id)}>
                  <BankLogo slug={b.slug} name={b.name} />
                  <span className="min-w-0">
                    <span className="block font-medium text-navy-900">{b.name}</span>
                    {b.territory && <span className="block truncate text-xs text-slate-500">{b.territory}</span>}
                  </span>
                </span>
              </label>
            </li>
          ))}
          <li>
            <label className="relative block h-full">
              <input type="radio" name="bank" value="other" checked={value === 'other'} onChange={() => onChange('other')} className="peer sr-only" />
              <span className={tile(value === 'other')}>
                <span aria-hidden className="grid h-14 w-24 shrink-0 place-items-center rounded-lg bg-sky-50 text-2xl font-bold text-ocean-600">+</span>
                <span className="font-medium text-navy-900">{t('apply.bank.other')}</span>
              </span>
            </label>
          </li>
        </ul>
        {filtered.length === 0 && <p className="mt-3 text-sm text-slate-500">{t('apply.bank.none')}</p>}
        {error && <p id={`${uid}-error`} role="alert" className="field-error">{error}</p>}
      </fieldset>

      <p aria-live="polite" className="text-sm text-lagoon-700">
        {selected ? t('apply.bank.selected', { name: selected.name }) : ''}
      </p>

      {value === 'other' && (
        <TextField
          label={t('apply.bank.otherName')}
          placeholder={t('apply.bank.otherName')}
          value={otherName}
          onChange={(e) => onOtherName(e.target.value)}
          maxLength={100}
          required
          autoComplete="off"
          hint={t('apply.bank.otherHint')}
          error={otherError}
        />
      )}
      <p className="text-xs text-slate-500">{t('apply.bank.example')}</p>
    </div>
  );
}