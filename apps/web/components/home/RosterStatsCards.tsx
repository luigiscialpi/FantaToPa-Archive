// apps/web/components/home/RosterStatsCards.tsx
//
// Le card più costose del pannello squadra (condividono la catena
// lineups→matches→matchdays→...→lineup_players su tutte le stagioni della
// squadra, vedi supabase-postgrest.md): isolate in un proprio Server
// Component asincrono con <Suspense> annidato (vedi TeamPanelSection) così
// il resto del pannello (bacheca, rivalità, record...) compare subito
// invece di aspettare anche queste.
import { createClient } from '../../lib/supabase/server';
import {
  getBestPlayerSeasons,
  getLongestUnbeatenStreak,
  getMostFieldedPlayers,
  getRosterStandout,
} from '../../lib/queries/home';
import { cachedHomeStat } from '../../lib/queries/home-cache';
import { KeyPlayersCard } from './KeyPlayersCard';
import { RosterStandoutCard } from './RosterStandoutCard';
import { PlayerSeasonStandoutCard } from './PlayerSeasonStandoutCard';
import { UnbeatenStreakCard } from './UnbeatenStreakCard';

export async function RosterStatsCards({ teamId }: { teamId: string }) {
  const supabase = await createClient();
  const [keyPlayers, standouts, seasonStandouts, streak] = await Promise.all([
    cachedHomeStat('most-fielded-players', teamId, () => getMostFieldedPlayers(supabase, teamId)),
    cachedHomeStat('roster-standout', teamId, () => getRosterStandout(supabase, teamId)),
    cachedHomeStat('best-player-seasons', teamId, () => getBestPlayerSeasons(supabase, teamId)),
    cachedHomeStat('unbeaten-streak', teamId, () => getLongestUnbeatenStreak(supabase, teamId)),
  ]);

  return (
    <>
      <KeyPlayersCard players={keyPlayers} />
      <UnbeatenStreakCard streak={streak} />
      <RosterStandoutCard standouts={standouts} />
      <PlayerSeasonStandoutCard standouts={seasonStandouts} />
    </>
  );
}
