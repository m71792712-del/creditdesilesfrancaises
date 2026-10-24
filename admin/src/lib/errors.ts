/** Codes d'erreur du backend (docs/CONTRACT.md §5) -> messages français. Le message technique brut n'est jamais affiché. */
const MESSAGES: Record<string, string> = {
  not_authenticated: 'Votre session a expiré. Reconnectez-vous.',
  forbidden: 'Action réservée à l’administrateur (ou double authentification requise).',
  not_found: 'Élément introuvable.',
  invalid_status: 'Statut invalide.',
  invalid_comment: 'Le commentaire doit contenir entre 3 et 500 caractères.',
  status_unchanged: 'La demande a déjà ce statut.',
  invalid_action: 'Action invalide.',
  invalid_type: 'Type invalide (banque ou fintech).',
  already_reviewed: 'Cette suggestion a déjà été traitée.',
  bank_exists: 'Cette banque existe déjà : utilisez « Fusionner ».',
  invalid_bank: 'Banque invalide.',
  invalid_setting: 'Valeur de réglage invalide.',
  mfa_enrollment_required: 'La double authentification doit d’abord être activée.',
};

export function backendMessage(message: string | undefined | null): string {
  if (!message) return 'Une erreur est survenue. Réessayez.';
  const code = Object.keys(MESSAGES).find((c) => message.includes(c));
  return code ? MESSAGES[code]! : 'Une erreur est survenue. Réessayez.';
}
