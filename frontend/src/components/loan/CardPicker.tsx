'use client';

import { useId } from 'react';
import { TextField } from '@/components/ui/TextField';
import { useI18n } from '@/lib/i18n/provider';
import type { CardType } from '@/types/db';
import { CardLogo } from './CardLogo';

interface Props {
  cardTypes: CardType[];
  value: string; // uuid, « other », ou chaîne vide pour « aucun »
  onChange: (id: string) => void;
  otherName: string;
  onOtherName: (name: string) => void;
  error?: string;
  otherError?: string;
}

/** Grille de types de carte, avec logo (facultatif : une tuile « Aucun » et une tuile « Autre carte » restent toujours disponibles). */
export function CardPicker({ cardTypes, value, onChange, otherName, onOtherName, error, otherError }: Props) {
  const { t } = useI18n();
  const uid = useId();

  const tile = (checked: boolean) =>
    `flex h-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition peer-focus-visible:ring-2 peer-focus-visible:ring-ocean-500 ${checked ? 'border-lagoon-500 bg-lagoon-50 ring-1 ring-lagoon-500' : 'border-slate-200 bg-white hover:border-sky-300'}`;

  return (
    <fieldset aria-describedby={error ? `${uid}-error` : undefined}>
      <legend className="label mb-2">{`${t('apply.card')} (${t('common.optional')})`}</legend>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <label className="relative block h-full">
            <input type="radio" name="cardType" value="" checked={value === ''} onChange={() => onChange('')} className="peer sr-only" />
            <span className={tile(value === '')}>
              <span aria-hidden className="grid h-14 w-24 shrink-0 place-items-center rounded-lg bg-sky-50 text-sm font-semibold text-ocean-600">{t('apply.card.none')}</span>
            </span>
          </label>
        </li>
        {cardTypes.map((c) => (
          <li key={c.id}>
            <label className="relative block h-full">
              <input type="radio" name="cardType" value={c.id} checked={value === c.id} onChange={() => onChange(c.id)} className="peer sr-only" />
              <span className={tile(value === c.id)}>
                <CardLogo name={c.name} />
                <span className="font-medium text-navy-900">{c.name}</span>
              </span>
            </label>
          </li>
        ))}
        <li>
          <label className="relative block h-full">
            <input type="radio" name="cardType" value="other" checked={value === 'other'} onChange={() => onChange('other')} className="peer sr-only" />
            <span className={tile(value === 'other')}>
              <span aria-hidden className="grid h-14 w-24 shrink-0 place-items-center rounded-lg bg-sky-50 text-2xl font-bold text-ocean-600">+</span>
              <span className="font-medium text-navy-900">{t('apply.card.other')}</span>
            </span>
          </label>
        </li>
      </ul>
      {error && <p id={`${uid}-error`} role="alert" className="field-error">{error}</p>}

      {value === 'other' && (
        <TextField
          label={t('apply.card.otherName')}
          placeholder={t('apply.card.otherName')}
          value={otherName}
          onChange={(e) => onOtherName(e.target.value)}
          maxLength={60}
          required
          autoComplete="off"
          error={otherError}
        />
      )}
    </fieldset>
  );
}