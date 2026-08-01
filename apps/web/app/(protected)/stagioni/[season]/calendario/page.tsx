// apps/web/app/(protected)/stagioni/[season]/calendario/page.tsx
import { notFound } from 'next/navigation';
import { createClient } from '../../../../../lib/supabase/server';
import { getCompetitions, getSeasons } from '../../../../../lib/queries/seasons';
import { getCalendario } from '../../../../../lib/queries/calendario';
import { MatchdayGroup } from '../../../../../components/calendario/MatchdayGroup';
import { MatchdayJumpBar } from '../../../../../components/calendario/MatchdayJumpBar';
import { ScrollToAnchor } from '../../../../../components/shared/ScrollToAnchor';

type CalendarioPageProps = {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ competizione?: string }>;
};

export default async function CalendarioPage({ params, searchParams }: CalendarioPageProps) {
  const { season: seasonSlug } = await params;
  const { competizione } = await searchParams;

  const supabase = await createClient();
  const seasons = await getSeasons(supabase);
  const season = seasons.find((candidate) => candidate.slug === seasonSlug);

  if (!season) {
    notFound();
  }

  const competitions = await getCompetitions(supabase, season.id);
  const activeCompetition = competizione
    ? competitions.find((candidate) => candidate.slug === competizione)
    : competitions[0];

  if (!activeCompetition) {
    notFound();
  }

  const matchdays = await getCalendario(supabase, activeCompetition.id, season.id);

  return (
    <main>
      <ScrollToAnchor />
      <div className="p-4">
        <div className="flex flex-row items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="font-serif font-bold text-xl text-brand-950 mb-0.5">{season.label}</h1>
            <p className="text-xs sm:text-sm text-stone-500">{activeCompetition.name}</p>
          </div>
          {matchdays.length > 0 && (
            <div className="shrink-0 flex justify-end">
              <MatchdayJumpBar matchdays={matchdays} />
            </div>
          )}
        </div>
        {matchdays.length === 0 ? (
          <p className="text-sm text-stone-500">Calendario non disponibile per questa competizione.</p>
        ) : (
          matchdays.map((matchday) => (
            <MatchdayGroup
              key={matchday.id}
              matchday={matchday}
              seasonSlug={season.slug}
              competitionSlug={activeCompetition.slug}
            />
          ))
        )}
      </div>
    </main>
  );
}
