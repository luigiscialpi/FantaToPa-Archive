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

  const bounds = await getMatchdayBounds(supabase, activeCompetition.id);
  const fromMatchday = da ? Number(da) : null;
  const toMatchday = a ? Number(a) : null;

  // "Filtrata" solo se l'intervallo scelto è un vero sotto-insieme della
  // stagione: se coincide con l'intera stagione usiamo lo snapshot importato
  // in `standings` (più affidabile, ha anche Gf/Gs) invece di ricalcolare.
  const isRangeFiltered =
    bounds !== null &&
    fromMatchday !== null &&
    toMatchday !== null &&
    (fromMatchday !== bounds.min || toMatchday !== bounds.max);

  const standings =
    isRangeFiltered && fromMatchday !== null && toMatchday !== null
      ? await getStandingsForRange(supabase, activeCompetition.id, { from: fromMatchday, to: toMatchday })
      : await getStandings(supabase, activeCompetition.id);

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
        <ClassificaTable key={`classifica-table-${activeCompetition.slug}`} rows={standings} />
      </div>
    </main>
  );
}
