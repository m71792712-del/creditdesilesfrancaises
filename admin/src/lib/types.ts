export const LOAN_STATUSES = ['pending', 'under_review', 'approved', 'rejected'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  under_review: 'En cours d’examen',
  approved: 'Approuvée',
  rejected: 'Refusée',
};

export interface LoanListRow {
  id: string;
  amount: number;
  currency: string;
  purpose_code: string;
  custom_bank_name: string | null;
  status: LoanStatus;
  created_at: string;
  profiles: { first_name: string; last_name: string; email: string } | null;
  banks: { name: string } | null;
  loan_purposes: { label_fr: string } | null;
}

export interface LoanDetail extends LoanListRow {
  user_id: string;
  purpose_details: string | null;
  description: string;
  updated_at: string;
  profiles: ProfileInfo | null;
  banks: { name: string; territory: string } | null;
  card_types: { name: string; family: string } | null;
}

export interface HistoryRow {
  id: string;
  old_status: string | null;
  new_status: string;
  comment: string | null;
  created_at: string;
}

export interface BankRow {
  id: string;
  slug: string;
  name: string;
  territory: string;
  type: 'bank' | 'fintech';
  is_active: boolean;
}

export interface SuggestionRow {
  id: string;
  name: string;
  submit_count: number;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  created_at: string;
  reviewed_at: string | null;
}

/** Informations saisies par l'utilisateur à l'inscription (demo_* = données de démonstration fictives). */
export interface ProfileInfo {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  demo_color: string | null;
  demo_city: string | null;
  demo_digit: number | null;
  created_at: string;
}

export interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: 'user' | 'admin';
  created_at: string;
}

export interface AuditRow {
  id: number | string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface Stats {
  users: number;
  loans: number;
  loans_last_7_days: number;
  banks_active: number;
  pending_suggestions: number;
  by_status: Record<string, number>;
}

export type ActionState = { ok?: string; error?: string } | null;
