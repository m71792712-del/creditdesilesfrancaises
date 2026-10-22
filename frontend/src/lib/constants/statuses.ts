export const LOAN_STATUSES = ['pending', 'under_review', 'approved', 'rejected'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CAD'] as const;
export const OTHER_PURPOSE = 'other';
