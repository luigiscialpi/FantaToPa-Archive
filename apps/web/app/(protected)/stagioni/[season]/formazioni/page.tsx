// apps/web/app/(protected)/stagioni/[season]/formazioni/page.tsx
import { notFound } from 'next/navigation';
import { createClient } from '../../../../../lib/supabase/server';
import { getCompetitions, getSeasons } from '../../../../../lib/queries/seasons';
import { getFormazioni, getMatchdayOptions } from '../../../../../lib/queries/formazioni';
import { MatchdaySelector } from '../../../../../components/formazioni/MatchdaySelector';
import { FormazioniList } from '../../../../../components/formazioni/FormazioniList';

type FormazioniPageProps = {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ competizione?: string; giornata?: string }>;
};

export default async function FormazioniPage({ params, searchParams }: FormazioniPageProps) {
  const { season: seasonSlug } = await params;
  const { competizione, giornata } = await searchParams;

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

  const matchdays = await getMatchdayOptions(supabase, activeCompetition.id);

  if (matchdays.length === 0) {
    return (
      <main>
        <div className="p-4">
          <h1 className="font-serif font-bold text-xl text-brand-950 mb-1">{season.label}</h1>
          <p className="text-sm text-stone-500 mb-4">{activeCompetition.name}</p>
          <p className="text-sm text-stone-500">Formazioni non disponibili per questa competizione.</p>
        </div>
      </main>
    );
  }

  const requestedNumber = giornata ? Number(giornata) : null;
  const activeMatchday =
    (requestedNumber !== null ? matchdays.find((candidate) => candidate.number === requestedNumber) : null) ??
    matchdays[0];

  if (!activeMatchday) {
    notFound();
  }

  const matches = await getFormazioni(supabase, activeMatchday.id);

  return (
    <main>
      <div className="p-4">
        <h1 className="font-serif font-bold text-xl text-brand-950 mb-1">{season.label}</h1>
        <p className="text-sm text-stone-500 mb-4">{activeCompetition.name}</p>
        <div className="mb-4">
          <MatchdaySelector
            seasonSlug={season.slug}
            competitionSlug={activeCompetition.slug}
            matchdays={matchdays}
            activeMatchdayNumber={activeMatchday.number}
          />
        </div>
        {matches.length === 0 ? (
          <p className="text-sm text-stone-500">Nessuna formazione disponibile per questa giornata.</p>
        ) : (
          <FormazioniList matches={matches} />
        )}
      </div>
    </main>
  );
}
