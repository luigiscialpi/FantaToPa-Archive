// apps/web/components/home/TeamPanelSection.tsx
//
// Pannello squadra personale come Server Component asincrono indipendente:
// isolato in un proprio <Suspense> (vedi page.tsx) così le sue query più
// pesanti (11 in parallelo, ciascuna su tutte le stagioni della squadra) non
// bloccano il rendering di galleria stagioni/vetrina generale mentre sono
// ancora in corso — quelle sezioni hanno un proprio Server Component e
// possono comparire prima o dopo, indipendentemente da questa.
import { createClient } from '../../lib/supabase/server';
import { getTeamBranding, brandingFor } from '../../lib/queries/team-branding';
import {
  getAllTimeTitleCounts,
  getBestPlayerSeasons,
  getLongestUnbeatenStreak,
  getMostFieldedPlayers,
  getOpponentRecords,
  getPersonalRecords,
  getRivalryHighlight,
  getRosterLoyalty,
  getRosterStandout,
  getStandingHistory,
} from '../../lib/queries/home';
import type { StandingsRow } from '../../lib/queries/classifica';
import { TeamPanel } from './TeamPanel';

type TeamPanelSectionProps = {
  teamId: string;
  seasonId: string;
  seasonSlug: string;
  ownStanding: StandingsRow | null;
  leaderStanding: StandingsRow | null;
};

export async function TeamPanelSection({
  teamId,
  seasonId,
  seasonSlug,
  ownStanding,
  leaderStanding,
}: TeamPanelSectionProps) {
  const supabase = await createClient();

  const [titleCounts, rivalry, records, keyPlayers, standingHistory, loyalty, standouts, seasonStandouts, streak, branding, teamRow, opponentRecords] =
    await Promise.all([
      getAllTimeTitleCounts(supabase),
      getRivalryHighlight(supabase, teamId),
      getPersonalRecords(supabase, teamId),
      getMostFieldedPlayers(supabase, teamId),
      getStandingHistory(supabase, teamId),
      getRosterLoyalty(supabase, teamId),
      getRosterStandout(supabase, teamId),
      getBestPlayerSeasons(supabase, teamId),
      getLongestUnbeatenStreak(supabase, teamId),
      getTeamBranding(supabase, seasonId, [teamId]),
      supabase.from('teams').select('canonical_name').eq('id', teamId).maybeSingle(),
      getOpponentRecords(supabase, teamId),
    ]);

  if (teamRow.error) {
    throw new Error(`Impossibile leggere la squadra: ${teamRow.error.message}`);
  }

  return (
    <div className="border-b border-stone-200 p-4">
      <TeamPanel
        teamName={teamRow.data?.canonical_name ?? ownStanding?.teamName ?? 'La tua squadra'}
        logoUrl={brandingFor(branding, teamId).logoUrl}
        seasonSlug={seasonSlug}
        standing={
          ownStanding
            ? { position: ownStanding.position, points: ownStanding.points, leaderPoints: leaderStanding?.points ?? null }
            : null
        }
        standingHistory={standingHistory}
        titles={titleCounts.get(teamId) ?? { campionati: 0, coppe: 0 }}
        rivalry={rivalry}
        records={records}
        keyPlayers={keyPlayers}
        loyalty={loyalty}
        standouts={standouts}
        seasonStandouts={seasonStandouts}
        streak={streak}
        bestOpponents={opponentRecords?.best ?? []}
        worstOpponents={opponentRecords?.worst ?? []}
      />
    </div>
  );
}
