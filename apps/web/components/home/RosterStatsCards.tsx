// apps/web/components/home/RosterStatsCards.tsx
//
// Le 3 card più costose del pannello squadra (condividono la catena
// lineups→matches→matchdays→...→lineup_players su tutte le stagioni della
// squadra, vedi supabase-postgrest.md): isolate in un proprio Server
// Component asincrono con <Suspense> annidato (vedi TeamPanelSection) così
// il resto del pannello (bacheca, rivalità, record...) compare subito
// invece di aspettare anche queste.
import { createClient } from '../../lib/supabase/server';
import { getBestPlayerSeasons, getMostFieldedPlayers, getRosterStandout } from '../../lib/queries/home';
import { KeyPlayersCard } from './KeyPlayersCard';
import { RosterStandoutCard } from './RosterStandoutCard';
import { PlayerSeasonStandoutCard } from './PlayerSeasonStandoutCard';

export async function RosterStatsCards({ teamId }: { teamId: string }) {
  const supabase = await createClient();
  const [keyPlayers, standouts, seasonStandouts] = await Promise.all([
    getMostFieldedPlayers(supabase, teamId),
    getRosterStandout(supabase, teamId),
    getBestPlayerSeasons(supabase, teamId),
  ]);

  return (
    <>
      <KeyPlayersCard players={keyPlayers} />
      <RosterStandoutCard standouts={standouts} />
      <PlayerSeasonStandoutCard standouts={seasonStandouts} />
    </>
  );
}
