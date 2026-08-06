// apps/web/app/(protected)/profilo-squadra/page.tsx
//
// Route top-level (come /albo-doro, /statistiche): la squadra mostrata è
// scelta liberamente (selettore in searchParams, come Statistiche), non
// vincolata all'utente loggato — ma senza selezione esplicita si parte
// dalla propria squadra (profiles.team_id), non dalla prima della lista.
// Riusa TeamPanelSection così com'è — è già parametrizzata per qualunque
// teamId/seasonId, nessuna nuova query: stesso identico contenuto del
// pannello squadra di Home.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { createClient } from '../../../lib/supabase/server';
import { getSessionState } from '../../../lib/auth/session';
import { getSeasons, getCompetitions } from '../../../lib/queries/seasons';
import { getAllTeams } from '../../../lib/queries/teams';
import { getStandings } from '../../../lib/queries/classifica';
import { TeamPanelSection } from '../../../components/home/TeamPanelSection';
import { TeamPanelSkeleton } from '../../../components/home/HomeSkeletons';
import { TeamSelector } from '../../../components/profilo-squadra/TeamSelector';

export const metadata: Metadata = { title: 'Profilo Squadra' };

type ProfiloSquadraPageProps = {
  searchParams: Promise<{ squadra?: string }>;
};

export default async function ProfiloSquadraPage({ searchParams }: ProfiloSquadraPageProps) {
  const { squadra } = await searchParams;
  const supabase = await createClient();

  // getSessionState() è wrappata in cache(): il layout protetto l'ha già
  // invocata in questa stessa render request (AGENTS.md), riuso gratuito.
  const [session, seasons, teams] = await Promise.all([getSessionState(), getSeasons(supabase), getAllTeams(supabase)]);

  if (teams.length === 0) {
    return (
      <main className="p-4">
        <h1 className="mb-1 font-serif font-bold text-xl text-brand-950">Profilo Squadra</h1>
        <p className="text-sm text-stone-500">Nessuna squadra ancora importata.</p>
      </main>
    );
  }

  // Senza selezione esplicita in searchParams, un utente proprietario di una
  // squadra (profiles.team_id) atterra sulla propria, non sulla prima della
  // lista.
  const ownTeamId = session.kind === 'autenticato' ? session.profile.teamId : null;
  const defaultTeam = (ownTeamId ? teams.find((team) => team.id === ownTeamId) : null) ?? teams[0]!;
  const activeTeam = (squadra ? teams.find((team) => team.slug === squadra) : null) ?? defaultTeam;

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
    <main>
      {/* TeamPanelSection sotto ha già il proprio p-4 interno (come in
          Home) — un p-4 anche qui raddoppierebbe il gutter laterale. */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
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
        <p className="px-4 pb-4 text-sm text-stone-500">Nessuna stagione ancora importata.</p>
      )}
    </main>
  );
}
