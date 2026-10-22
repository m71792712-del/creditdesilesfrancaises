import { Loader2 } from 'lucide-react';
import { getT } from '@/lib/i18n';

export default async function Loading() {
  const { t } = await getT();
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-24 text-slate-600">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {t('common.loading')}
    </div>
  );
}
