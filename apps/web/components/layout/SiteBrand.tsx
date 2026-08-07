// apps/web/components/layout/SiteBrand.tsx
//
// Client component solo per poter derivare isHome da usePathname(): il
// resto di AppHeader non ha bisogno di hook e resta un server component.
// Su mobile il nome corto "FantaTopa" è usato ovunque tranne che in homepage
// (che non ha selettore stagione in header e può permettersi il nome lungo);
// su desktop/tablet è sempre "FantaToPa Archive".
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SiteBrand() {
  const isHome = usePathname() === '/';

  return (
    <Link href="/" className="block font-serif font-bold tracking-tight text-base sm:text-lg truncate hover:text-stone-100 transition-colors">
      <span className="sm:hidden">{isHome ? 'FantaToPa Archive' : 'FantaTopa'}</span>
      <span className="hidden sm:inline">FantaToPa Archive</span>
    </Link>
  );
}

