/** Codes d'erreur du backend (docs/CONTRACT.md §5) -> clés de traduction « err.<code> ». */
export const BACKEND_ERROR_CODES = [
  'not_authenticated',
  'forbidden',
  'invalid_amount',
  'amount_out_of_range',
  'invalid_currency',
  'invalid_purpose',
  'purpose_details_required',
  'purpose_details_unexpected',
  'invalid_description',
  'invalid_bank',
  'invalid_card_type',
  'rate_limited',
  'not_found',
  'cannot_delete_admin',
] as const;

export type BackendErrorCode = (typeof BACKEND_ERROR_CODES)[number];

export function backendErrorCode(message: string | undefined | null): BackendErrorCode | null {
  if (!message) return null;
  return BACKEND_ERROR_CODES.find((c) => message.includes(c)) ?? null;
}

export function backendErrorKey(message: string | undefined | null): string {
  const code = backendErrorCode(message);
  return code ? `err.${code}` : 'err.generic';
}

/** Champ du formulaire de demande concerné par chaque code (pour renvoyer l'utilisateur à la bonne étape). */
export const ERROR_FIELD: Partial<Record<BackendErrorCode, string>> = {
  invalid_amount: 'amount',
  amount_out_of_range: 'amount',
  invalid_currency: 'currency',
  invalid_purpose: 'purposeCode',
  purpose_details_required: 'purposeDetails',
  purpose_details_unexpected: 'purposeDetails',
  invalid_description: 'description',
  invalid_bank: 'bankId',
  invalid_card_type: 'cardTypeId',
};
