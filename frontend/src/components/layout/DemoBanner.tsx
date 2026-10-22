import { TriangleAlert } from 'lucide-react';
import { getT } from '@/lib/i18n';

export async function DemoBanner() {
  const { t } = await getT();
  return (
    <div role="note" className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm">
      <TriangleAlert className="mr-1.5 inline h-4 w-4 align-text-bottom" aria-hidden />
      {t('demo.warning')}
    </div>
  );
}
