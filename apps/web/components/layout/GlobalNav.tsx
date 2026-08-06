// apps/web/components/layout/GlobalNav.tsx
//
// Nav globale persistente (sezione 10 del piano, mockup TopNav): distinta dai
// tab per-stagione di PageTabs (Classifica/Calendario/Rose/Formazioni), che
// vivono solo sotto /stagioni/[season]/**. Questa vive dentro AppHeader,
// visibile su ogni pagina protetta — Home, Albo d'Oro, Statistiche e Profilo
// Squadra non sono scoped a una singola stagione (Albo d'Oro mostra tutte
// le annate insieme, Statistiche/Profilo Squadra scelgono stagione/
// competizione/squadra al loro interno). Client component per
// usePathname() (evidenzia la voce attiva).
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Home', exact: true },
  { href: '/albo-doro', label: "Albo d'Oro", exact: false },
  { href: '/statistiche', label: 'Statistiche', exact: false },
  { href: '/profilo-squadra', label: 'Profilo Squadra', exact: false },
];

export function GlobalNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 sm:gap-6 overflow-x-auto overflow-y-hidden scrollbar-none min-w-0">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`py-1.5 text-xs sm:text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              active ? 'border-amber-400 text-amber-300' : 'border-transparent text-brand-200/90 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
