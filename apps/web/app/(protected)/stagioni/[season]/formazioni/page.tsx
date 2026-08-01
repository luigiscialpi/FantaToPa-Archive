// apps/web/app/(protected)/stagioni/[season]/formazioni/page.tsx
import { notFound } from 'next/navigation';
import { createClient } from '../../../../../lib/supabase/server';
import { getCompetitions, getSeasons } from '../../../../../lib/queries/seasons';
import { getFormazioni, getMatchdayOptions } from '../../../../../lib/queries/formazioni';
import { MatchdaySelector } from '../../../../../components/formazioni/MatchdaySelector';
import { FormazioniList } from '../../../../../components/formazioni/FormazioniList';
import { DataGapNotice } from '../../../../../components/shared/DataGapNotice';
import { ScrollToAnchor } from '../../../../../components/shared/ScrollToAnchor';

type FormazioniPageProps = {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ competizione?: string; giornata?: string; partita?: string }>;
};

export default async function FormazioniPage({ params, searchParams }: FormazioniPageProps) {
  const { season: seasonSlug } = await params;
  const { competizione, giornata, partita } = await searchParams;

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
          <DataGapNotice message="Le formazioni di questa competizione non sono disponibili: i dati sorgente per questa stagione non le includono." />
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

  const matches = await getFormazioni(supabase, activeMatchday.id, season.id);
  // Se ?partita= non corrisponde a nessuna partita di questa giornata
  // (link stantio, o giornata cambiata), si ricade sul default (prima
  // partita) invece di ignorare silenziosamente il match del tutto.
  const activeMatchId = partita && matches.some((match) => match.matchId === partita) ? partita : null;

  return (
    <main>
      <ScrollToAnchor />
      <div className="p-4">
        <div className="flex flex-row items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="font-serif font-bold text-xl text-brand-950 mb-0.5">{season.label}</h1>
            <p className="text-xs sm:text-sm text-stone-500">{activeCompetition.name}</p>
          </div>
          <div className="shrink-0 flex justify-end">
            <MatchdaySelector
              seasonSlug={season.slug}
              competitionSlug={activeCompetition.slug}
              matchdays={matchdays}
              activeMatchdayNumber={activeMatchday.number}
            />
          </div>
        </div>
        {matches.length === 0 ? (
          <DataGapNotice message="Le formazioni di questa giornata non sono disponibili: i dati sorgente per questa stagione non le includono." />
        ) : (
          <FormazioniList matches={matches} initialExpandedMatchId={activeMatchId} />
        )}
      </div>
    </main>
  );
}
