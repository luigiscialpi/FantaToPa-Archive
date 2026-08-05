// apps/web/app/(protected)/profilo-squadra/page.tsx
//
// Route top-level (come /albo-doro, /statistiche): il pannello squadra qui
// non è quello dell'utente loggato ma di una squadra scelta liberamente
// (selettore in searchParams, come Statistiche). Riusa TeamPanelSection
// così com'è — è già parametrizzata per qualunque teamId/seasonId, nessuna
// nuova query: stesso identico contenuto del pannello squadra di Home.
import { Suspense } from 'react';
import { createClient } from '../../../lib/supabase/server';
import { getSeasons, getCompetitions } from '../../../lib/queries/seasons';
import { getAllTeams } from '../../../lib/queries/teams';
import { getStandings } from '../../../lib/queries/classifica';
import { TeamPanelSection } from '../../../components/home/TeamPanelSection';
import { TeamPanelSkeleton } from '../../../components/home/HomeSkeletons';
import { TeamSelector } from '../../../components/profilo-squadra/TeamSelector';

type ProfiloSquadraPageProps = {
  searchParams: Promise<{ squadra?: string }>;
};

export default async function ProfiloSquadraPage({ searchParams }: ProfiloSquadraPageProps) {
  const { squadra } = await searchParams;
  const supabase = await createClient();

  const [seasons, teams] = await Promise.all([getSeasons(supabase), getAllTeams(supabase)]);

  if (teams.length === 0) {
    return (
      <main className="p-4">
        <h1 className="mb-1 font-serif font-bold text-xl text-brand-950">Profilo Squadra</h1>
        <p className="text-sm text-stone-500">Nessuna squadra ancora importata.</p>
      </main>
    );
  }

  const activeTeam = teams.find((team) => team.slug === squadra) ?? teams[0]!;
  const latestSeason = seasons[0] ?? null;

  let ownStanding = null;
  let leaderStanding = null;
  if (latestSeason) {
    const competitions = await getCompetitions(supabase, latestSeason.id);
    const campionato = competitions.find((competition) => competition.kindCode === 'campionato') ?? null;
    const standings = campionato ? await getStandings(supabase, campionato.id, latestSeason.id) : [];
    ownStanding = standings.find((row) => row.teamId === activeTeam.id) ?? null;
    leaderStanding = standings.find((row) => row.position === 1) ?? null;
  }

  return (
    <main className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h1 className="font-serif font-bold text-xl text-brand-950">Profilo Squadra</h1>
        <TeamSelector teams={teams} activeTeamSlug={activeTeam.slug} />
      </div>

      {latestSeason ? (
        <Suspense key={activeTeam.id} fallback={<TeamPanelSkeleton />}>
          <TeamPanelSection
            teamId={activeTeam.id}
            seasonId={latestSeason.id}
            seasonSlug={latestSeason.slug}
            ownStanding={ownStanding}
            leaderStanding={leaderStanding}
          />
        </Suspense>
      ) : (
        <p className="text-sm text-stone-500">Nessuna stagione ancora importata.</p>
      )}
    </main>
  );
}
