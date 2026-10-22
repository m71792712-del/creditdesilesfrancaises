export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
} | null;

export type LoanActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };
