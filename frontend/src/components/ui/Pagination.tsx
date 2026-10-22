import Link from 'next/link';
import type { TFunction } from '@/lib/i18n/shared';

interface Props {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  t: TFunction;
}

export function Pagination({ page, total, pageSize, basePath, t }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const cls = 'btn btn-outline btn-sm';
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
      {page > 1 ? <Link href={`${basePath}?page=${page - 1}`} className={cls}>{t('common.previous')}</Link> : <span />}
      <span className="text-sm text-slate-600">{t('common.page', { page, total: pages })}</span>
      {page < pages ? <Link href={`${basePath}?page=${page + 1}`} className={cls}>{t('common.next')}</Link> : <span />}
    </nav>
  );
}
