// apps/web/lib/queries/formazioni.ts
//
// Layer di query per Formazioni: stesso pattern di classifica.ts/
// calendario.ts (AGENTS.md vieta query Supabase nei componenti React).
// Niente embed postgrest — query separate (matches, teams, lineups,
// lineup_players, players) + merge in memoria.
//
// Nessun ruolo per giocatore in lineup_players (vedi supabase/migrations:
// non è chiaro se il "ruolo" della fonte xlsx sia quello schierato quel
// giorno o l'insieme dei ruoli idonei, quindi non è modellato). L'ordine di
// visualizzazione usa solo position_order, così come arriva dal file
// sorgente (portiere, poi difensori, ecc.).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';

type TypedSupabaseClient = SupabaseClient<Database>;

export type MatchdayOption = {
  id: string;
  number: number;
  label: string | null;
};

// Ordine decrescente (giornata più recente per prima): a differenza di
// Calendario (che mostra tutte le giornate in sequenza), qui si guarda una
// giornata alla volta e la più recente è il punto di partenza più utile.
export async function getMatchdayOptions(
  supabase: TypedSupabaseClient,
  competitionId: string,
): Promise<MatchdayOption[]> {
  const { data, error } = await supabase
    .from('matchdays')
    .select('id, number, label')
    .eq('competition_id', competitionId)
    .order('number', { ascending: false });

  if (error) {
    throw new Error(`Impossibile leggere le giornate: ${error.message}`);
  }

  return data;
}

export type LineupPlayerRow = {
  playerId: string;
  playerName: string;
  slot: 'titolare' | 'panchina';
  voto: number | null;
  fantavoto: number | null;
  // Dal colore del fantavoto nel file sorgente (verde = conta per il
  // totale squadra): non deducibile da voto/fantavoto, un panchinaro può
  // avere un voto reale e comunque non contare, o viceversa sostituire un
  // titolare e contare pur restando in panchina.
  countsForTotal: boolean;
};

export type TeamLineup = {
  teamName: string;
  formation: string | null;
  totalScore: number | null;
  defenseModifier: number;
  submittedVia: 'app' | 'web' | null;
  submittedAt: string | null;
  starters: LineupPlayerRow[];
  bench: LineupPlayerRow[];
};

export type FormazioniMatch = {
  matchId: string;
  home: TeamLineup;
  away: TeamLineup;
};

export async function getFormazioni(supabase: TypedSupabaseClient, matchdayId: string): Promise<FormazioniMatch[]> {
  const { data: matchesRows, error: matchesError } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_score, away_score')
    .eq('matchday_id', matchdayId);

  if (matchesError) {
    throw new Error(`Impossibile leggere le partite: ${matchesError.message}`);
  }

  if (matchesRows.length === 0) {
    return [];
  }

  const matchIds = matchesRows.map((match) => match.id);
  const teamIds = [...new Set(matchesRows.flatMap((match) => [match.home_team_id, match.away_team_id]))];

  const [teamsResult, lineupsResult] = await Promise.all([
    supabase.from('teams').select('id, canonical_name').in('id', teamIds),
    supabase
      .from('lineups')
      .select('id, match_id, team_id, formation, defense_modifier, submitted_via, submitted_at')
      .in('match_id', matchIds),
  ]);

  if (teamsResult.error) {
    throw new Error(`Impossibile leggere le squadre: ${teamsResult.error.message}`);
  }
  if (lineupsResult.error) {
    throw new Error(`Impossibile leggere le formazioni: ${lineupsResult.error.message}`);
  }

  const teamNameById = new Map<string, string>();
  for (const team of teamsResult.data) {
    teamNameById.set(team.id, team.canonical_name);
  }

  // Const locale (non lineupsResult.data direttamente): il narrowing
  // non-null di TS sull'errore sopra non attraversa la closure
  // buildTeamLineup più sotto se si riusa la property access originale.
  const lineups = lineupsResult.data;
  const lineupIds = lineups.map((lineup) => lineup.id);
  const playersByLineup = new Map<string, LineupPlayerRow[]>();

  if (lineupIds.length > 0) {
    const { data: lineupPlayersRows, error: lineupPlayersError } = await supabase
      .from('lineup_players')
      .select('lineup_id, player_id, slot, voto, fantavoto, counts_for_total')
      .in('lineup_id', lineupIds)
      .order('position_order', { ascending: true });

    if (lineupPlayersError) {
      throw new Error(`Impossibile leggere i giocatori in formazione: ${lineupPlayersError.message}`);
    }

    const playerIds = [...new Set(lineupPlayersRows.map((row) => row.player_id))];
    const playerNameById = new Map<string, string>();

    if (playerIds.length > 0) {
      const { data: playersRows, error: playersError } = await supabase
        .from('players')
        .select('id, canonical_name')
        .in('id', playerIds);

      if (playersError) {
        throw new Error(`Impossibile leggere i giocatori: ${playersError.message}`);
      }

      for (const player of playersRows) {
        playerNameById.set(player.id, player.canonical_name);
      }
    }

    for (const row of lineupPlayersRows) {
      const playerRow: LineupPlayerRow = {
        playerId: row.player_id,
        playerName: playerNameById.get(row.player_id) ?? '—',
        slot: row.slot === 'panchina' ? 'panchina' : 'titolare',
        voto: row.voto,
        fantavoto: row.fantavoto,
        countsForTotal: row.counts_for_total,
      };
      const bucket = playersByLineup.get(row.lineup_id);
      if (bucket) {
        bucket.push(playerRow);
      } else {
        playersByLineup.set(row.lineup_id, [playerRow]);
      }
    }
  }

  function buildTeamLineup(matchId: string, teamId: string, totalScore: number | null): TeamLineup {
    const lineup = lineups.find((candidate) => candidate.match_id === matchId && candidate.team_id === teamId);
    const players = lineup ? (playersByLineup.get(lineup.id) ?? []) : [];

    return {
      teamName: teamNameById.get(teamId) ?? '—',
      formation: lineup?.formation ?? null,
      totalScore,
      defenseModifier: lineup?.defense_modifier ?? 0,
      submittedVia: lineup?.submitted_via === 'app' || lineup?.submitted_via === 'web' ? lineup.submitted_via : null,
      submittedAt: lineup?.submitted_at ?? null,
      starters: players.filter((player) => player.slot === 'titolare'),
      bench: players.filter((player) => player.slot === 'panchina'),
    };
  }

  return matchesRows.map((match) => ({
    matchId: match.id,
    home: buildTeamLineup(match.id, match.home_team_id, match.home_score),
    away: buildTeamLineup(match.id, match.away_team_id, match.away_score),
  }));
}
