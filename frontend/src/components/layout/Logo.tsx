import Image from 'next/image';
import Link from 'next/link';
import { APP_NAME } from '@/lib/config';

export function Logo({ light = false, size = 40, href = '/' }: { light?: boolean; size?: number; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <Image src="/images/logo-icon.png" alt="" width={size} height={size} className="rounded-full" />
      <span className={`max-w-[9rem] text-sm font-bold leading-tight sm:text-base ${light ? 'text-white' : 'text-navy-900'}`}>{APP_NAME}</span>
    </Link>
  );
}
