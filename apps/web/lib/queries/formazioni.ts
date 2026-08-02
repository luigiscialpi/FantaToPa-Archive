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
import { getTeamBranding, brandingFor } from './team-branding';

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

export type PlayerBonus = {
  code: string;
  label: string;
};

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
  bonuses: PlayerBonus[];
};

export type TeamLineup = {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  jerseyUrl: string | null;
  formation: string | null;
  totalScore: number | null;
  defenseModifier: number;
  fieldAdvantage: number;
  submittedVia: 'app' | 'web' | null;
  submittedAt: string | null;
  starters: LineupPlayerRow[];
  bench: LineupPlayerRow[];
};

export type FormazioniMatch = {
  matchId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  home: TeamLineup;
  // null per il blocco "solo" di un girone con numero dispari di squadre
  // (vedi adapters/xlsx/lineup.ts): quella giornata la squadra home non ha
  // avversario.
  away: TeamLineup | null;
};

export async function getFormazioni(
  supabase: TypedSupabaseClient,
  matchdayId: string,
  seasonId: string,
): Promise<FormazioniMatch[]> {
  const { data: matchesRows, error: matchesError } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_score, away_score, home_goals, away_goals')
    .eq('matchday_id', matchdayId);

  if (matchesError) {
    throw new Error(`Impossibile leggere le partite: ${matchesError.message}`);
  }

  if (matchesRows.length === 0) {
    return [];
  }

  const matchIds = matchesRows.map((match) => match.id);
  const teamIds = [
    ...new Set(
      matchesRows.flatMap((match) => [match.home_team_id, match.away_team_id]).filter((id): id is string => id !== null),
    ),
  ];

  const [teamsResult, lineupsResult] = await Promise.all([
    supabase.from('teams').select('id, canonical_name').in('id', teamIds),
    supabase
      .from('lineups')
      .select('id, match_id, team_id, formation, defense_modifier, field_advantage, submitted_via, submitted_at')
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

  const branding = await getTeamBranding(supabase, seasonId, teamIds);

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

    // Bonus/malus: una giornata di Coppa non ha bonus propri (la fonte HTML
    // copre solo Campionato), ma "eredita" quelli della giornata di
    // Campionato corrispondente tramite matchday_bonus_sources — se non
    // c'è mapping (Coppa non ancora collegata, o giornata futura), niente
    // bonus mostrati, nessun errore.
    const { data: bonusSourceRow, error: bonusSourceError } = await supabase
      .from('matchday_bonus_sources')
      .select('source_matchday_id')
      .eq('matchday_id', matchdayId)
      .maybeSingle();
    if (bonusSourceError) {
      throw new Error(`Impossibile leggere la corrispondenza bonus: ${bonusSourceError.message}`);
    }
    const bonusMatchdayId = bonusSourceRow?.source_matchday_id ?? matchdayId;

    const bonusesByPlayer = new Map<string, PlayerBonus[]>();
    if (playerIds.length > 0) {
      const [bonusRowsResult, bonusKindsResult] = await Promise.all([
        supabase
          .from('player_matchday_bonuses')
          .select('player_id, kind_code, position_order')
          .eq('matchday_id', bonusMatchdayId)
          .in('player_id', playerIds)
          .order('position_order', { ascending: true }),
        supabase.from('bonus_kinds').select('code, label'),
      ]);
      if (bonusRowsResult.error) {
        throw new Error(`Impossibile leggere i bonus/malus: ${bonusRowsResult.error.message}`);
      }
      if (bonusKindsResult.error) {
        throw new Error(`Impossibile leggere i tipi di bonus/malus: ${bonusKindsResult.error.message}`);
      }

      const labelByCode = new Map<string, string>();
      for (const kind of bonusKindsResult.data) {
        labelByCode.set(kind.code, kind.label);
      }

      for (const row of bonusRowsResult.data) {
        const bonus: PlayerBonus = { code: row.kind_code, label: labelByCode.get(row.kind_code) ?? row.kind_code };
        const bucket = bonusesByPlayer.get(row.player_id);
        if (bucket) {
          bucket.push(bonus);
        } else {
          bonusesByPlayer.set(row.player_id, [bonus]);
        }
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
        bonuses: bonusesByPlayer.get(row.player_id) ?? [],
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
    const teamBranding = brandingFor(branding, teamId);

    return {
      teamId,
      teamName: teamBranding.displayName ?? teamNameById.get(teamId) ?? '—',
      logoUrl: teamBranding.logoUrl,
      jerseyUrl: teamBranding.jerseyUrl,
      formation: lineup?.formation ?? null,
      totalScore,
      defenseModifier: lineup?.defense_modifier ?? 0,
      fieldAdvantage: lineup?.field_advantage ?? 0,
      submittedVia: lineup?.submitted_via === 'app' || lineup?.submitted_via === 'web' ? lineup.submitted_via : null,
      submittedAt: lineup?.submitted_at ?? null,
      starters: players.filter((player) => player.slot === 'titolare'),
      bench: players.filter((player) => player.slot === 'panchina'),
    };
  }

  return matchesRows.map((match) => ({
    matchId: match.id,
    homeGoals: match.home_goals,
    awayGoals: match.away_goals,
    home: buildTeamLineup(match.id, match.home_team_id, match.home_score),
    away: match.away_team_id ? buildTeamLineup(match.id, match.away_team_id, match.away_score) : null,
  }));
}

// Coppa Girone A/B (competitions.format_code = 'gironi'): il file sorgente
// accoppia le squadre a due a due solo per impaginazione (stesso export di
// Campionato/Fase Finale), ma non è un incontro 1-contro-1 — ogni giornata è
// "formula uno", punteggio cumulato dell'intero girone (vedi AGENTS.md).
// Si riusa getFormazioni per il fetch (stesso merge bonus/branding) e si
// appiattiscono le coppie in righe singole, ordinate per punteggio di
// giornata invece che a coppie.
export async function getGironeFormazioni(
  supabase: TypedSupabaseClient,
  matchdayId: string,
  seasonId: string,
): Promise<TeamLineup[]> {
  const matches = await getFormazioni(supabase, matchdayId, seasonId);
  const teams = matches.flatMap((match) => (match.away ? [match.home, match.away] : [match.home]));

  teams.sort((a, b) => (b.totalScore ?? -Infinity) - (a.totalScore ?? -Infinity));

  return teams;
}
