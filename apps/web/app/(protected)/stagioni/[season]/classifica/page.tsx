import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '../../../../../lib/supabase/server';
import { getCompetitions, getSeasons } from '../../../../../lib/queries/seasons';
import { getMatchdayBounds, getStandings, getStandingsForRange } from '../../../../../lib/queries/classifica';
import { getSessionState } from '../../../../../lib/auth/session';
import { ClassificaTable } from '../../../../../components/classifica/ClassificaTable';
import { GiornataRangeFilter } from '../../../../../components/classifica/GiornataRangeFilter';
import { EditModeToggle } from '../../../../../components/admin/EditModeToggle';

type ClassificaPageProps = {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ competizione?: string; da?: string; a?: string; modifica?: string }>;
};

// Lo slug è già leggibile ("2025-26"): nessuna query in più solo per il titolo.
export async function generateMetadata({ params }: ClassificaPageProps): Promise<Metadata> {
  const { season } = await params;
  return { title: `Classifica ${season}` };
}

export default async function ClassificaPage({ params, searchParams }: ClassificaPageProps) {
  const { season: seasonSlug } = await params;
  const { competizione, da, a, modifica } = await searchParams;

  const supabase = await createClient();
  const session = await getSessionState();
  const isAdmin = session.kind === 'autenticato' && session.profile.role === 'admin';
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
  let isRangeFiltered = false;

  if (!hasRangeParams) {
    [bounds, standings] = await Promise.all([
      getMatchdayBounds(supabase, activeCompetition.id),
      getStandings(supabase, activeCompetition.id, season.id),
    ]);
  } else {
    bounds = await getMatchdayBounds(supabase, activeCompetition.id);
    isRangeFiltered = bounds !== null && (fromMatchday !== bounds.min || toMatchday !== bounds.max);

    standings = isRangeFiltered
      ? await getStandingsForRange(supabase, activeCompetition.id, { from: fromMatchday, to: toMatchday }, season.id)
      : await getStandings(supabase, activeCompetition.id, season.id);
  }

  // Modifica solo sullo snapshot reale (righe con `id`, da getStandings): la
  // vista filtrata per range non ha righe scrivibili, quindi niente editMode
  // anche se ?modifica=1 resta nell'URL passando da un filtro all'altro.
  const editMode = isAdmin && modifica === '1' && !isRangeFiltered;

  return (
    <main>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="font-serif font-bold text-xl text-brand-950">{season.label}</h1>
          {isAdmin && !isRangeFiltered && (
            <Suspense>
              <EditModeToggle active={editMode} />
            </Suspense>
          )}
        </div>
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
        <ClassificaTable
          key={`classifica-table-${activeCompetition.slug}`}
          rows={standings}
          seasonSlug={season.slug}
          editMode={editMode}
        />
      </div>
    </main>
  );
}
