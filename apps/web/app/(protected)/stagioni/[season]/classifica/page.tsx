import { notFound } from 'next/navigation';
import { createClient } from '../../../../../lib/supabase/server';
import { getCompetitions, getSeasons } from '../../../../../lib/queries/seasons';
import { getMatchdayBounds, getStandings, getStandingsForRange } from '../../../../../lib/queries/classifica';
import { ClassificaTable } from '../../../../../components/classifica/ClassificaTable';
import { GiornataRangeFilter } from '../../../../../components/classifica/GiornataRangeFilter';

type ClassificaPageProps = {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ competizione?: string; da?: string; a?: string }>;
};

export default async function ClassificaPage({ params, searchParams }: ClassificaPageProps) {
  const { season: seasonSlug } = await params;
  const { competizione, da, a } = await searchParams;

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

  const fromMatchday = da ? Number(da) : null;
  const toMatchday = a ? Number(a) : null;
  const hasRangeParams = fromMatchday !== null && toMatchday !== null;

  // Caso comune (nessun filtro range): bounds e standings sono indipendenti,
  // lanciali in parallelo. Quando da/a sono nei searchParams, bounds serve
  // prima per decidere se il range è un vero sotto-insieme della stagione
  // (se no, usiamo lo snapshot da `standings` che ha anche Gf/Gs).
  let bounds: Awaited<ReturnType<typeof getMatchdayBounds>>;
  let standings: Awaited<ReturnType<typeof getStandings>>;

  if (!hasRangeParams) {
    [bounds, standings] = await Promise.all([
      getMatchdayBounds(supabase, activeCompetition.id),
      getStandings(supabase, activeCompetition.id, season.id),
    ]);
  } else {
    bounds = await getMatchdayBounds(supabase, activeCompetition.id);
    const isRangeFiltered =
      bounds !== null &&
      (fromMatchday !== bounds.min || toMatchday !== bounds.max);

    standings = isRangeFiltered
      ? await getStandingsForRange(supabase, activeCompetition.id, { from: fromMatchday, to: toMatchday }, season.id)
      : await getStandings(supabase, activeCompetition.id, season.id);
  }

  return (
    <main>
      <div className="p-4">
        <h1 className="font-serif font-bold text-xl text-brand-950 mb-1">{season.label}</h1>
        <p className="text-sm text-stone-500 mb-4">{activeCompetition.name}</p>
        {bounds && (
          <GiornataRangeFilter
            key={`giornata-filter-${activeCompetition.slug}`}
            seasonSlug={season.slug}
            competitionSlug={activeCompetition.slug}
            min={bounds.min}
            max={bounds.max}
            from={fromMatchday ?? bounds.min}
            to={toMatchday ?? bounds.max}
          />
        )}
        <ClassificaTable key={`classifica-table-${activeCompetition.slug}`} rows={standings} seasonSlug={season.slug} />
      </div>
    </main>
  );
}
