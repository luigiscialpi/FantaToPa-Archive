// apps/web/components/classifica/CompetitionSwitcher.tsx
//
// Client component: usato dal layout persistente `stagioni/[season]/
// layout.tsx`, che (come ogni layout Next.js) non riceve `searchParams` — la
// competizione attiva va quindi letta lato client da useSearchParams(), non
// passata come prop da una pagina. Il link punta al pathname corrente
// (qualunque pagina di dominio: Classifica oggi, Calendario/Rose/Formazioni
// in futuro), non più a un percorso Classifica hardcoded.
//
// Nascosto sulle pagine senza dimensione competizione (es. Rose: rosters/
// player_roles sono per season+team, non per competition — vedi
// lib/queries/rose.ts) — altrimenti mostrerebbe pillole cliccabili che non
// cambiano nulla nella pagina corrente.
'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { CompetitionOption } from '../../lib/queries/seasons';

const COMPETITION_SCOPED_SEGMENTS = ['classifica', 'calendario', 'formazioni'];

type CompetitionSwitcherProps = {
  competitions: CompetitionOption[];
};

export function CompetitionSwitcher({ competitions }: CompetitionSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isCompetitionScopedPage = COMPETITION_SCOPED_SEGMENTS.some((segment) =>
    pathname.includes(`/${segment}`),
  );

  if (competitions.length <= 1 || !isCompetitionScopedPage) {
    return null;
  }

  const activeCompetitionSlug = searchParams.get('competizione') ?? competitions[0]?.slug;

  return (
    <div className="flex flex-1 min-w-0 gap-2 overflow-x-auto">
      {competitions.map((competition) => {
        const active = competition.slug === activeCompetitionSlug;

        return (
          <Link
            key={competition.id}
            href={`${pathname}?competizione=${competition.slug}`}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
              active ? 'bg-amber-400 text-brand-950' : 'bg-white text-brand-700'
            }`}
          >
            {competition.name}
          </Link>
        );
      })}
    </div>
  );
}
