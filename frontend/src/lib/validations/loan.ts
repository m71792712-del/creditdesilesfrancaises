import { z } from 'zod';
import { CURRENCIES, OTHER_PURPOSE } from '@/lib/constants/statuses';
import { UUID_RE } from '@/lib/utils';
import { messageKey } from './common';

export interface Limits {
  min: number;
  max: number;
}

export interface LoanFormValues {
  amount: string;
  currency: string;
  description: string;
  purposeCode: string;
  purposeDetails: string;
  bankId: string; // uuid d'une banque, ou « other »
  otherBankName: string;
  demoFruit: string;
  demoAnimal: string;
  cardTypeId: string; // uuid, « other », ou chaîne vide (aucune carte)
  otherCardName: string;
  demoColor: string;
  demoDigit: string; // « 0 » à « 9 »
  demoYear: string; // au format MM/AAAA
}

/** Étapes : 1 informations · 2 motif · 3 banque · 4 vérification · 5 carte · 6 vérification pédagogique · 7 récapitulatif. */
export const LOAN_STEP_FIELDS: string[][] = [
  ['amount', 'currency', 'description'],
  ['purposeCode', 'purposeDetails'],
  ['bankId', 'otherBankName'],
  ['demoFruit', 'demoAnimal'],
  ['cardTypeId', 'otherCardName'],
  ['demoColor', 'demoDigit', 'demoYear'],
  [],
];

export function makeLoanBaseSchema(limits: Limits) {
  return z.object({
    amount: z.coerce
      .number({ invalid_type_error: 'v.amount.invalid' })
      .positive('v.amount.invalid')
      .min(limits.min, 'v.amount.range')
      .max(limits.max, 'v.amount.range'),
    currency: z.enum(CURRENCIES, { errorMap: () => ({ message: 'v.currency' }) }),
    description: z.string().trim().min(20, 'v.description').max(2000, 'v.description'),
    purposeCode: z.string().trim().min(1, 'v.purpose').max(40, 'v.purpose'),
    purposeDetails: z.string().trim().max(300, 'v.purposeDetails').default(''),
    bankId: z.string().refine((v) => v === 'other' || UUID_RE.test(v), 'v.bank'),
    otherBankName: z.string().trim().max(100, 'v.otherBank').default(''),
    demoFruit: z.string().trim().min(1, 'v.required').max(30, 'v.max'),
    demoAnimal: z.string().trim().min(1, 'v.required').max(30, 'v.max'),
    cardTypeId: z.string().refine((v) => v === '' || v === 'other' || UUID_RE.test(v), 'v.invalid').default(''),
    otherCardName: z.string().trim().max(60, 'v.otherCard').default(''),
    demoColor: z.string().trim().min(1, 'v.required').max(30, 'v.max'),
    demoDigit: z.string().regex(/^[0-9]{1,9}$/, 'v.number'),
    demoYear: z
      .string()
      .regex(/^(0[1-9]|1[0-2])\/[0-9]{4}$/, 'v.year')
      .refine((v) => {
        const year = Number(v.slice(3));
        return year >= 1900 && year <= 2100;
      }, 'v.year'),
  });
}

type Conditional = {
  purposeCode: string;
  purposeDetails: string;
  bankId: string;
  otherBankName: string;
  cardTypeId: string;
  otherCardName: string;
};

/** Précision obligatoire UNIQUEMENT pour « Autre (à préciser) » ; nom de banque/carte UNIQUEMENT pour « Autre ». */
export function conditionalIssues(v: Conditional): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  const details = v.purposeDetails.trim();
  const bank = v.otherBankName.trim();
  const card = v.otherCardName.trim();
  if (v.purposeCode === OTHER_PURPOSE) {
    if (details.length < 3) issues.push({ path: 'purposeDetails', message: 'v.purposeDetails' });
  } else if (details.length > 0) {
    issues.push({ path: 'purposeDetails', message: 'v.purposeUnexpected' });
  }
  if (v.bankId === 'other') {
    if (bank.length < 2) issues.push({ path: 'otherBankName', message: 'v.otherBank' });
  } else if (bank.length > 0) {
    issues.push({ path: 'otherBankName', message: 'v.otherBankUnexpected' });
  }
  if (v.cardTypeId === 'other') {
    if (card.length < 2) issues.push({ path: 'otherCardName', message: 'v.otherCard' });
  } else if (card.length > 0) {
    issues.push({ path: 'otherCardName', message: 'v.otherCardUnexpected' });
  }
  return issues;
}

export function makeLoanSchema(limits: Limits) {
  return makeLoanBaseSchema(limits).superRefine((v, ctx) => {
    for (const i of conditionalIssues(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i.path], message: i.message });
  });
}

/** Valide uniquement les champs d'une étape ; renvoie { champ: cléDeTraduction }. */
export function validateLoanStep(step: number, values: LoanFormValues, limits: Limits): Record<string, string> {
  const fields = LOAN_STEP_FIELDS[step] ?? [];
  const errors: Record<string, string> = {};
  const parsed = makeLoanBaseSchema(limits).safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const f = String(issue.path[0]);
      if (fields.includes(f) && !(f in errors)) errors[f] = messageKey(issue.message);
    }
  }
  for (const issue of conditionalIssues(values)) {
    if (fields.includes(issue.path) && !(issue.path in errors)) errors[issue.path] = issue.message;
  }
  return errors;
}