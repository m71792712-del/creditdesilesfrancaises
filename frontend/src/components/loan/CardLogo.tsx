'use client';

import Image from 'next/image';
import { useState } from 'react';
import { slugify } from '@/lib/utils';

/** Logo WebP (public/cards/<slug>.webp) sur badge blanc ; initiales si le fichier est absent. */
export function CardLogo({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const slug = slugify(name);
  return (
    <span className="grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
      {failed ? (
        <span aria-hidden className="text-lg font-bold text-navy-700">{name.slice(0, 2).toUpperCase()}</span>
      ) : (
        <Image
          src={`/cards/${slug}.webp`}
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