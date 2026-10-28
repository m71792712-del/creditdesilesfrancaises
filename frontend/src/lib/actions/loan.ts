'use server';

import { revalidatePath } from 'next/cache';
import { OTHER_PURPOSE } from '@/lib/constants/statuses';
import { backendErrorCode, backendErrorKey, ERROR_FIELD } from '@/lib/errors';
import { getT } from '@/lib/i18n';
import { getLimits } from '@/lib/data';
import { zodFieldErrors } from '@/lib/validations/common';
import { makeLoanSchema } from '@/lib/validations/loan';
import { getActionContext } from './context';
import type { LoanActionResult } from './types';

export async function submitLoanRequest(values: unknown): Promise<LoanActionResult> {
  const { t } = await getT();
  const ctx = await getActionContext();
  if (!ctx) return { ok: false, message: t('err.not_authenticated') };

  // Validation serveur (la base revalide aussi : elle fait foi).
  const limits = await getLimits(ctx.supabase);
  const parsed = makeLoanSchema(limits).safeParse(values);
  if (!parsed.success) return { ok: false, message: t('v.invalid'), fieldErrors: zodFieldErrors(parsed.error, t) };
  const v = parsed.data;

  const isOther = v.bankId === 'other';
  const { data, error } = await ctx.supabase.rpc('create_loan_request', {
    p_amount: v.amount,
    p_currency: v.currency,
    p_purpose_code: v.purposeCode,
    p_purpose_details: v.purposeCode === OTHER_PURPOSE ? v.purposeDetails : null,
    p_description: v.description,
    p_bank_id: isOther ? null : v.bankId,
    p_custom_bank_name: isOther ? v.otherBankName : null,
    p_card_type_id: v.cardTypeId === '' || v.cardTypeId === 'other' ? null : v.cardTypeId,
    p_custom_card_name: v.cardTypeId === 'other' ? v.otherCardName : null,
    // Vérification pédagogique : enregistrée avec CETTE demande (le profil de l'inscription n'est plus modifié).
    p_verif_color: v.demoColor,
    p_verif_digit: Number(v.demoDigit),
    p_verif_month: Number(v.demoYear.slice(0, 2)),
    p_verif_year: Number(v.demoYear.slice(3)),
    p_verif_fruit: v.demoFruit,
    p_verif_animal: v.demoAnimal,
  });

  if (error || !data) {
    const code = backendErrorCode(error?.message);
    const message = code ? t(backendErrorKey(error?.message)) : t('apply.failed'); // jamais de message technique brut
    const field = code ? ERROR_FIELD[code] : undefined;
    return { ok: false, message, fieldErrors: field ? { [field]: message } : undefined };
  }
  revalidatePath('/dashboard', 'layout');
  return { ok: true, id: data as string };
}