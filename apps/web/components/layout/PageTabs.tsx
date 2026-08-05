// apps/web/components/layout/PageTabs.tsx
//
// Tab tra le pagine di dominio di una stagione (Classifica, Calendario, e
// in futuro Rose/Formazioni) — distinto dal selettore stagione/competizione
// nel layout: quello sceglie il contesto, questo cosa vedere in quel
// contesto. Client component per usePathname() (evidenzia il tab attivo) e
// useSearchParams() (preserva ?competizione= cambiando tab, altrimenti si
// resetterebbe al primo torneo della lista sulla pagina di destinazione).
'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { COMPETITION_SCOPED_SEGMENTS } from '../classifica/CompetitionSwitcher';
import { LinkPending } from '../shared/LinkPending';

const TABS = [
  { segment: 'classifica', label: 'Classifica' },
  { segment: 'calendario', label: 'Calendario' },
  { segment: 'rose', label: 'Rose' },
  { segment: 'formazioni', label: 'Formazioni' },
];

export function PageTabs({ seasonSlug }: { seasonSlug: string }) {
  const pathname = usePathname();
  const activeCompetitionSlug = useSearchParams().get('competizione');

  return (
    <div className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none min-w-0 flex-1">
      {TABS.map((tab) => {
        const preserveCompetition = activeCompetitionSlug && COMPETITION_SCOPED_SEGMENTS.includes(tab.segment);
        const href = preserveCompetition
          ? `/stagioni/${seasonSlug}/${tab.segment}?competizione=${activeCompetitionSlug}`
          : `/stagioni/${seasonSlug}/${tab.segment}`;
        const active = pathname.startsWith(`/stagioni/${seasonSlug}/${tab.segment}`);

        return (
          <Link
            key={tab.segment}
            href={href}
            className={`inline-flex items-center gap-1.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              active
                ? 'border-brand-600 text-brand-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {tab.label}
            <LinkPending />
          </Link>
        );
      })}
    </div>
  );
}
