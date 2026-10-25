import type { Metadata } from 'next';
import { LoanWizard } from '@/components/loan/LoanWizard';
import { requireUser } from '@/lib/auth';
import { getReferenceData } from '@/lib/data';
import { getT } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Nouveau prêt' };

export default async function ApplyPage() {
  const { t } = await getT();
  await requireUser();
  const supabase = await createClient();
  const ref = await getReferenceData(supabase);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">{t('apply.title')}</h1>
      <LoanWizard
        banks={ref.banks}
        purposes={ref.purposes}
        cardTypes={ref.cardTypes}
        limits={ref.limits}
      />
    </div>
  );
}