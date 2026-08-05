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
import { LinkPending } from '../shared/LinkPending';
import type { CompetitionOption } from '../../lib/queries/seasons';

// Esportato: PageTabs (components/layout/) lo riusa per preservare il
// torneo attivo quando si cambia tab, invece di duplicare l'elenco.
export const COMPETITION_SCOPED_SEGMENTS = ['classifica', 'calendario', 'formazioni'];

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
    <div className="bg-stone-100/90 px-4 py-2 border-b border-stone-200/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 shrink-0 mr-1 hidden sm:inline">
        Torneo:
      </span>
      {competitions.map((competition) => {
        const active = competition.slug === activeCompetitionSlug;

        return (
          <Link
            key={competition.id}
            href={`${pathname}?competizione=${competition.slug}`}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs whitespace-nowrap transition-all ${
              active
                ? 'bg-brand-600 text-white font-semibold shadow-xs'
                : 'bg-white text-stone-700 border border-stone-200/90 hover:bg-stone-50 hover:text-stone-900 font-medium'
            }`}
          >
            {competition.name}
            <LinkPending />
          </Link>
        );
      })}
    </div>
  );
}
