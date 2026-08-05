// apps/web/app/(protected)/statistiche/page.tsx
//
// Route top-level (non sotto stagioni/[season]/**): a differenza di
// Classifica/Formazioni, qui stagione e competizione sono un filtro della
// pagina stessa (searchParams), non il contesto del selettore persistente in
// header — vedi mockup StatisticheView, che ha i propri select interni.
import type { Metadata } from 'next';
import { createClient } from '../../../lib/supabase/server';
import { getCompetitions, getSeasons } from '../../../lib/queries/seasons';
import { getComparableTeams, getHeadToHeadSeries } from '../../../lib/queries/statistiche';
import { StatisticheControls } from '../../../components/statistiche/StatisticheControls';
import { HeadToHeadChart } from '../../../components/statistiche/HeadToHeadChart';

export const metadata: Metadata = { title: 'Statistiche' };

type StatisticheSearchParams = {
  stagione?: string;
  competizione?: string;
  squadra1?: string;
  squadra2?: string;
  tipo?: string;
};

export default async function StatistichePage({
  searchParams,
}: {
  searchParams: Promise<StatisticheSearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Solo stagioni con giornate reali: senza `matches` non c'è nulla da
  // confrontare (stesso filtro del selettore stagione in AppHeader).
  const seasons = (await getSeasons(supabase)).filter((season) => season.hasSchedule);
  if (seasons.length === 0) {
    return (
      <main className="p-4">
        <h1 className="mb-1 font-serif font-bold text-xl text-brand-950">Statistiche</h1>
        <p className="text-sm text-stone-500">Nessuna stagione con calendario ancora importata.</p>
      </main>
    );
  }

  const season = seasons.find((candidate) => candidate.slug === params.stagione) ?? seasons[0]!;

  const competitions = await getCompetitions(supabase, season.id);
  if (competitions.length === 0) {
    return (
      <main className="p-4">
        <h1 className="mb-1 font-serif font-bold text-xl text-brand-950">Statistiche</h1>
        <p className="text-sm text-stone-500">Nessuna competizione disponibile per questa stagione.</p>
      </main>
    );
  }

  const competition =
    competitions.find((candidate) => candidate.slug === params.competizione) ??
    competitions.find((candidate) => candidate.kindCode === 'campionato') ??
    competitions[0]!;

  const teams = await getComparableTeams(supabase, competition.id, season.id);
  const team1 = teams.find((team) => team.slug === params.squadra1) ?? teams[0] ?? null;
  const team2 = teams.find((team) => team.slug === params.squadra2) ?? teams.find((team) => team.slug !== team1?.slug) ?? null;

  const statType = params.tipo === 'fantapunti' ? 'fantapunti' : 'punti';

  const series = team1 && team2 ? await getHeadToHeadSeries(supabase, competition.id, team1.teamId, team2.teamId) : [];

  return (
    <main className="p-4">
      <h1 className="mb-1 font-serif font-bold text-xl text-brand-950">Statistiche</h1>
      <p className="mb-4 text-sm text-stone-500">Confronta punti o fantapunti di due squadre nella stessa competizione.</p>

      <StatisticheControls
        // Le select sono non controllate (defaultValue): quando l'esito
        // effettivo (dopo i fallback sopra) differisce da ciò che l'utente
        // ha scelto prima di premere "Aggiorna", una key diversa forza il
        // remount del form così le select ripartono dai valori risolti dal
        // server invece di restare bloccate sul defaultValue del mount
        // precedente.
        key={`${season.slug}-${competition.slug}-${team1?.slug ?? ''}-${team2?.slug ?? ''}-${statType}`}
        seasons={seasons}
        competitions={competitions}
        teams={teams}
        seasonSlug={season.slug}
        competitionSlug={competition.slug}
        team1Slug={team1?.slug ?? null}
        team2Slug={team2?.slug ?? null}
        statType={statType}
      />

      {teams.length < 2 ? (
        <p className="text-sm text-stone-500">Servono almeno due squadre con classifica per questo confronto.</p>
      ) : (
        <div className="rounded-xl bg-white border border-stone-200 p-4">
          <HeadToHeadChart
            points={series}
            team1Label={team1?.name ?? '—'}
            team2Label={team2?.name ?? '—'}
            statType={statType}
          />
        </div>
      )}
    </main>
  );
}
