// apps/web/app/(protected)/stagioni/[season]/rose/page.tsx
//
// Tutte le rose una sotto l'altra (non più una sola dietro un tab), con una
// barra in alto che scrolla alla rosa scelta invece di cambiare pagina — vedi
// RosterJumpBar. Niente searchParams qui: la squadra "attiva" non è più uno
// stato di navigazione, è solo il punto di scroll iniziale.
import { notFound } from 'next/navigation';
import { createClient } from '../../../../../lib/supabase/server';
import { getSeasons } from '../../../../../lib/queries/seasons';
import { getRoster, getTeamManagers, getTeamsWithRoster } from '../../../../../lib/queries/rose';
import { getTeamBranding, brandingFor } from '../../../../../lib/queries/team-branding';
import { getSessionState } from '../../../../../lib/auth/session';
import { RosterJumpBar } from '../../../../../components/rose/RosterJumpBar';
import { TeamRosterHeader } from '../../../../../components/rose/TeamRosterHeader';
import { RosterTable } from '../../../../../components/rose/RosterTable';
import { DataGapNotice } from '../../../../../components/shared/DataGapNotice';

type RosePageProps = {
  params: Promise<{ season: string }>;
};

// Squadra di fallback quando l'utente loggato non ha una squadra assegnata
// (es. admin): richiesta esplicitamente come rosa di riferimento di default.
const FALLBACK_TEAM_SLUG = 'prozalpi-s-f';

export default async function RosePage({ params }: RosePageProps) {
  const { season: seasonSlug } = await params;

  const supabase = await createClient();
  const seasons = await getSeasons(supabase);
  const season = seasons.find((candidate) => candidate.slug === seasonSlug);

  if (!season) {
    notFound();
  }

  const teams = await getTeamsWithRoster(supabase, season.id);

  if (teams.length === 0) {
    return (
      <main>
        <div className="p-4">
          <h1 className="font-serif font-bold text-xl text-brand-950 mb-1">{season.label}</h1>
          <p className="text-sm text-stone-500">Rose non disponibili per questa stagione.</p>
        </div>
      </main>
    );
  }

  const [session, branding, managers, rosters] = await Promise.all([
    getSessionState(),
    getTeamBranding(supabase, season.id, teams.map((team) => team.id)),
    getTeamManagers(supabase),
    Promise.all(teams.map((team) => getRoster(supabase, season.id, team.id))),
  ]);

  const myTeamId = session.kind === 'autenticato' ? session.profile.teamId : null;
  const defaultTeam =
    (myTeamId ? teams.find((team) => team.id === myTeamId) : undefined) ??
    teams.find((team) => team.slug === FALLBACK_TEAM_SLUG) ??
    teams[0]!;

  return (
    <main>
      <div className="p-4">
        <h1 className="font-serif font-bold text-xl text-brand-950 mb-1">{season.label}</h1>
        <p className="text-sm text-stone-500 mb-4">Rose</p>

        {season.slug === '2022-23' && (
          <DataGapNotice message="Per questa stagione non esiste un file rose originale della lega: le rose sono state ricostruite dalle formazioni di campionato (giornate 31-38) e potrebbero non coincidere esattamente con la rosa di fine stagione." />
        )}

        <div className="mb-6">
          <RosterJumpBar teams={teams} defaultTeamSlug={defaultTeam.slug} />
        </div>

        <div className="space-y-6">
          {teams.map((team, index) => {
            const teamBranding = brandingFor(branding, team.id);

            return (
              <section
                key={team.id}
                id={`squadra-${team.slug}`}
                className="scroll-mt-28 rounded-xl bg-white border border-stone-200 overflow-hidden"
              >
                <TeamRosterHeader
                  teamName={team.name}
                  logoUrl={teamBranding.logoUrl}
                  jerseyUrl={teamBranding.jerseyUrl}
                  managerName={managers.get(team.id) ?? null}
                  creditsRemaining={teamBranding.creditsRemaining}
                />
                <RosterTable players={rosters[index] ?? []} />
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

