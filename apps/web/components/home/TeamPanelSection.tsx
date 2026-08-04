// apps/web/components/home/TeamPanelSection.tsx
//
// Pannello squadra personale come Server Component asincrono indipendente:
// isolato in un proprio <Suspense> (vedi page.tsx) così le sue query più
// pesanti non bloccano il rendering di galleria stagioni/vetrina generale
// mentre sono ancora in corso — quelle sezioni hanno un proprio Server
// Component e possono comparire prima o dopo, indipendentemente da questa.
// Le query più costose in assoluto (roster stats, vedi RosterStatsCards)
// hanno un secondo <Suspense> annidato qui dentro: il resto del pannello
// compare non appena pronto, senza aspettare anche quelle.
import { Suspense } from 'react';
import { createClient } from '../../lib/supabase/server';
import { getTeamBranding, brandingFor } from '../../lib/queries/team-branding';
import {
  getAllTimeTitleCounts,
  getOpponentRecords,
  getPersonalRecords,
  getRivalryHighlight,
  getRosterLoyalty,
  getStandingHistory,
  type TitleCounts,
} from '../../lib/queries/home';
import type { StandingsRow } from '../../lib/queries/classifica';
import { cachedHomeStat } from '../../lib/queries/home-cache';
import { TeamPanel } from './TeamPanel';
import { RosterStatsCards } from './RosterStatsCards';
import { RosterStatsCardsSkeleton } from './HomeSkeletons';

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

  const [titleCountEntries, rivalry, records, standingHistory, loyalty, branding, teamRow, opponentRecords] = await Promise.all([
    // unstable_cache serializza il risultato: una Map non sopravvive al
    // round-trip (torna un oggetto vuoto senza .get), quindi si cachea
    // l'array di entries e si ricostruisce la Map subito dopo.
    cachedHomeStat('title-counts', null, async () => Array.from((await getAllTimeTitleCounts(supabase)).entries())),
    cachedHomeStat('rivalry', teamId, () => getRivalryHighlight(supabase, teamId)),
    cachedHomeStat('personal-records', teamId, () => getPersonalRecords(supabase, teamId)),
    cachedHomeStat('standing-history', teamId, () => getStandingHistory(supabase, teamId)),
    cachedHomeStat('roster-loyalty', teamId, () => getRosterLoyalty(supabase, teamId)),
    getTeamBranding(supabase, seasonId, [teamId]),
    supabase.from('teams').select('canonical_name').eq('id', teamId).maybeSingle(),
    cachedHomeStat('opponent-records', teamId, () => getOpponentRecords(supabase, teamId)),
  ]);
  const titleCounts = new Map<string, TitleCounts>(titleCountEntries);

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
        loyalty={loyalty}
        rosterStatsSlot={
          <Suspense fallback={<RosterStatsCardsSkeleton />}>
            <RosterStatsCards teamId={teamId} />
          </Suspense>
        }
        bestOpponents={opponentRecords?.best ?? []}
        worstOpponents={opponentRecords?.worst ?? []}
      />
    </div>
  );
}
