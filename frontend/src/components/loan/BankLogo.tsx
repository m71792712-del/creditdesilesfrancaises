'use client';

import Image from 'next/image';
import { useState } from 'react';
import { initials } from '@/lib/utils';

/** Logo WebP optimisé (public/banks/<slug>.webp) sur badge blanc ; initiales si le fichier est absent. */
export function BankLogo({ slug, name }: { slug: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const words = name.trim().split(/\s+/);
  return (
    <span className="grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
      {failed ? (
        <span aria-hidden className="text-lg font-bold text-navy-700">{initials(words[0] ?? '', words[1] ?? '')}</span>
      ) : (
        <Image
          src={`/banks/${slug}.webp`}
          alt={name}
          width={96}
          height={48}
          unoptimized
          className="max-h-12 w-auto max-w-[5.5rem] object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
