// apps/web/components/layout/PageTabs.tsx
//
// Tab tra le pagine di dominio di una stagione (Classifica, Calendario, e
// in futuro Rose/Formazioni) — distinto dal selettore stagione/competizione
// nel layout: quello sceglie il contesto, questo cosa vedere in quel
// contesto. Client component per usePathname() (evidenzia il tab attivo).
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { segment: 'classifica', label: 'Classifica' },
  { segment: 'calendario', label: 'Calendario' },
];

export function PageTabs({ seasonSlug }: { seasonSlug: string }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-4 px-4 border-b border-stone-200 bg-white">
      {TABS.map((tab) => {
        const href = `/stagioni/${seasonSlug}/${tab.segment}`;
        const active = pathname.startsWith(href);

        return (
          <Link
            key={tab.segment}
            href={href}
            className={`py-2 text-sm font-semibold border-b-2 -mb-px ${
              active ? 'border-brand-600 text-brand-800' : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
