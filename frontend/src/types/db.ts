import type { LoanStatus } from '@/lib/constants/statuses';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string;
  role: 'user' | 'admin';
  demo_color: string | null;
  demo_city: string | null;
  demo_digit: number | null;
  created_at: string;
}
export interface Bank { id: string; slug: string; name: string; territory: string; type: 'bank' | 'fintech' }
export interface CardType { id: string; family: string; name: string }
export interface Purpose { code: string; label_fr: string; label_en: string }
export interface LoanRow {
  id: string;
  amount: number;
  currency: string;
  purpose_code: string;
  purpose_details: string | null;
  description: string;
  custom_bank_name: string | null;
  custom_card_name: string | null;
  status: LoanStatus;
  created_at: string;
  banks: { name: string; slug: string } | null;
  card_types: { name: string } | null;
}
export interface HistoryRow { id: string; old_status: string | null; new_status: string; comment: string | null; created_at: string }
