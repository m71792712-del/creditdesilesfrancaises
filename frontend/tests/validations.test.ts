import { describe, expect, it } from 'vitest';
import { loginSchema, profileSchema, registerSchema } from '@/lib/validations/auth';
import { makeLoanSchema, validateLoanStep, type LoanFormValues } from '@/lib/validations/loan';

const limits = { min: 500, max: 100000 };
const BANK = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const valid: LoanFormValues = {
  amount: '5000', currency: 'EUR', description: 'Projet fictif de démonstration pour les tests automatisés.',
  purposeCode: 'personal', purposeDetails: '', bankId: BANK, otherBankName: '', demoFruit: 'Mangue', demoAnimal: 'Iguane', cardTypeId: '', otherCardName: '',
  demoColor: 'Bleu', demoDigit: '7', demoYear: '1998',
};
const errs = (v: unknown) => {
  const r = makeLoanSchema(limits).safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}:${i.message}`);
};

describe('inscription', () => {
  const ok = { lastName: 'Dupont', firstName: 'Jean', phone: '+590 690 00 00 00', email: 'Jean@Exemple.com', demoColor: 'Bleu', demoCity: 'Nice', demoDigit: '000',password: 'Motdepasse1', terms: 'on' };
  it('accepte une inscription valide et normalise l’e-mail', () => {
    const r = registerSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('jean@exemple.com');
  });
  it('impose 8 caractères, une lettre et un chiffre', () => {
    const msg = (password: string) => { const r = registerSchema.safeParse({ ...ok, password }); return r.success ? [] : r.error.issues.map((i) => i.message); };
    expect(msg('abc12')).toContain('v.password.min');
    expect(msg('12345678')).toContain('v.password.letter');
    expect(msg('abcdefgh')).toContain('v.password.digit');
    expect(msg('abcdefg1')).toEqual([]);
  });
  it('exige les conditions, un téléphone valide et les champs fictifs', () => {
    expect(registerSchema.safeParse({ ...ok, terms: '' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, phone: 'abc' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, demoColor: '' }).success).toBe(false);
  });
  it('valide la connexion et le profil', () => {
    expect(loginSchema.safeParse({ email: 'pas-un-email', password: 'x' }).success).toBe(false);
    expect(profileSchema.safeParse({ lastName: 'Dupont', firstName: 'Jean', phone: '+590 690 00 00 00', demoColor: '', demoCity: '', demoDigit: '' }).success).toBe(true);
    expect(profileSchema.safeParse({ lastName: 'Dupont', firstName: 'Jean', phone: '+590 690 00 00 00', demoColor: '', demoCity: '', demoDigit: '12' }).success).toBe(false);
  });
});

describe('demande de prêt', () => {
  it('accepte une demande valide', () => expect(errs(valid)).toEqual([]));
  it('impose les limites de montant', () => {
    expect(errs({ ...valid, amount: '100' })).toContain('amount:v.amount.range');
    expect(errs({ ...valid, amount: '999999' })).toContain('amount:v.amount.range');
    expect(errs({ ...valid, amount: '-5' })).toContain('amount:v.amount.invalid');
    expect(errs({ ...valid, amount: 'abc' })).toContain('amount:v.amount.invalid');
  });
  it('exige la précision uniquement pour « Autre »', () => {
    expect(errs({ ...valid, purposeCode: 'other' })).toContain('purposeDetails:v.purposeDetails');
    expect(errs({ ...valid, purposeCode: 'other', purposeDetails: 'Achat de matériel' })).toEqual([]);
    expect(errs({ ...valid, purposeDetails: 'texte' })).toContain('purposeDetails:v.purposeUnexpected');
  });
  it('exige le nom de la banque uniquement pour « Autre banque »', () => {
    expect(errs({ ...valid, bankId: 'other' })).toContain('otherBankName:v.otherBank');
    expect(errs({ ...valid, bankId: 'other', otherBankName: 'Banque Locale' })).toEqual([]);
    expect(errs({ ...valid, otherBankName: 'Banque Locale' })).toContain('otherBankName:v.otherBankUnexpected');
    expect(errs({ ...valid, bankId: 'pas-un-uuid' })).toContain('bankId:v.bank');
  });
  it('valide les champs fictifs et la description', () => {
        expect(errs({ ...valid, demoDigit: 'abc' })).toContain('demoDigit:v.number');
    expect(errs({ ...valid, demoColor: '' })).toContain('demoColor:v.required');
    expect(errs({ ...valid, description: 'trop court' })).toContain('description:v.description');
  });
  it('valide étape par étape', () => {
    expect(validateLoanStep(0, { ...valid, amount: '' }, limits).amount).toBeTruthy();
    expect(validateLoanStep(1, { ...valid, purposeCode: 'other' }, limits).purposeDetails).toBe('v.purposeDetails');
    expect(validateLoanStep(2, { ...valid, bankId: '' }, limits).bankId).toBeTruthy();
    expect(validateLoanStep(3, valid, limits)).toEqual({});
    expect(validateLoanStep(4, valid, limits)).toEqual({});
  });
  it('ne contient aucun champ de carte bancaire', () => {
    const keys = Object.keys(valid);
    expect(keys.some((k) => /cvv|iban|cardnumber|expiry|pin/i.test(k))).toBe(false);
  });
});
