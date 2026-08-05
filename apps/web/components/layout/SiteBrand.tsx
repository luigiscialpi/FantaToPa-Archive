// apps/web/components/layout/SiteBrand.tsx
//
// Client component solo per poter derivare isTopLevel da usePathname(): il
// resto di AppHeader non ha bisogno di hook e resta un server component. Il
// nome esteso "FantaToPa Archive" vale nelle stesse route di GlobalNav (Home,
// Albo d'Oro, Statistiche, Profilo Squadra: non scoped a una singola
// stagione), non solo in homepage — fuori da lì su mobile resta il nome
// corto "FantaTopa" (spazio limitato accanto a hamburger + selettore
// stagione compatto), su desktop/tablet è sempre "FantaToPa Archive".
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isTopLevelRoute } from '../../lib/navigation/top-level-routes';

export function SiteBrand() {
  const isTopLevel = isTopLevelRoute(usePathname());

  return (
    <Link href="/" className="block font-serif font-bold tracking-tight text-base sm:text-lg truncate hover:text-stone-100 transition-colors">
      <span className="sm:hidden">{isTopLevel ? 'FantaToPa Archive' : 'FantaTopa'}</span>
      <span className="hidden sm:inline">FantaToPa Archive</span>
    </Link>
  );
}

