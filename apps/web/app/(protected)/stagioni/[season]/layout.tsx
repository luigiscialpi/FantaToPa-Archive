// apps/web/app/(protected)/stagioni/[season]/layout.tsx
//
// Toolbar tab/competizione persistente per tutte le pagine di dominio sotto
// una stagione (Classifica, Calendario, Rose, Formazioni) — sezione 10 del
// piano. Il selettore stagione vive nell'header globale (AppHeader), non
// più qui: da lì è raggiungibile anche fuori da questa route (es. Home).
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient } from '../../../../lib/supabase/server';
import { getCompetitions, getSeasons } from '../../../../lib/queries/seasons';
import { PageTabs } from '../../../../components/layout/PageTabs';
import { CompetitionSwitcher } from '../../../../components/classifica/CompetitionSwitcher';

type SeasonLayoutProps = {
  children: ReactNode;
  params: Promise<{ season: string }>;
};

export default async function SeasonLayout({ children, params }: SeasonLayoutProps) {
  const { season: seasonSlug } = await params;

  const supabase = await createClient();
  const seasons = await getSeasons(supabase);
  const season = seasons.find((candidate) => candidate.slug === seasonSlug);

  if (!season) {
    notFound();
  }

  const competitions = await getCompetitions(supabase, season.id);

  return (
    <div>
      <Suspense fallback={
        <div className="bg-white border-b border-stone-200/90 px-4 h-[41px] sticky top-[87px] sm:top-[89px] z-10" aria-hidden="true" />
      }>
        <div className="bg-white border-b border-stone-200/90 px-4 flex items-center gap-3 sticky top-[87px] sm:top-[89px] z-10">
          <PageTabs seasonSlug={season.slug} />
        </div>
      </Suspense>
      <Suspense fallback={
        competitions.length > 1
          ? <div className="bg-stone-100/90 px-4 py-2 border-b border-stone-200/80 h-[37px]" aria-hidden="true" />
          : null
      }>
        <CompetitionSwitcher competitions={competitions} />
      </Suspense>
      {children}
    </div>
  );
}
