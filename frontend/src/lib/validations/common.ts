import type { ZodError } from 'zod';
import type { TFunction } from '@/lib/i18n/shared';

/** Les schémas Zod renvoient des CLÉS de traduction (v.*), traduites à l'affichage. */
export function messageKey(message: string): string {
  return message.startsWith('v.') ? message : 'v.invalid';
}

export function zodFieldErrors(error: ZodError, t: TFunction): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '_form');
    if (!(field in out)) out[field] = t(messageKey(issue.message));
  }
  return out;
}
