// apps/web/app/(protected)/stagioni/[season]/layout.tsx
//
// Toolbar stagione/competizione persistente per tutte le pagine di dominio
// sotto una stagione (Classifica oggi, Calendario/Rose/Formazioni in
// futuro) — sezione 10 del piano: "selettore stagione/competizione
// persistente in header (stile cambio-branch)". Vive qui e non nel layout
// (protected) più esterno perché solo a questo livello di route esiste il
// parametro `[season]`.
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient } from '../../../../lib/supabase/server';
import { getCompetitions, getSeasons } from '../../../../lib/queries/seasons';
import { SeasonSwitcher } from '../../../../components/layout/SeasonSwitcher';
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
      <div className="bg-white border-b border-stone-200/90 px-4 flex items-center justify-between gap-3 sticky top-0 z-10">
        <PageTabs seasonSlug={season.slug} />
        <SeasonSwitcher seasons={seasons} activeSeasonSlug={season.slug} />
      </div>
      <Suspense fallback={null}>
        <CompetitionSwitcher competitions={competitions} />
      </Suspense>
      {children}
    </div>
  );
}
