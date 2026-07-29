// apps/web/lib/queries/classifica.ts
//
// Layer di query per la Classifica: AGENTS.md vieta query Supabase dentro i
// componenti React, quindi tutto l'accesso ai dati vive qui. Niente join via
// embed di postgrest-js (es. `select('...,teams(...)')`): l'inferenza dei
// tipi per gli embed è fragile fra versioni di @supabase/postgrest-js, due
// query separate + merge in memoria sono più semplici da tenere corrette.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';
import { getTeamBranding, brandingFor } from './team-branding';

type TypedSupabaseClient = SupabaseClient<Database>;

export type StandingsRow = {
  position: number | null;
  teamName: string;
  teamSlug: string;
  jerseyUrl: string | null;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDiff: number | null;
  points: number | null;
  totalFantapoints: number | null;
};

export async function getStandings(
  supabase: TypedSupabaseClient,
  competitionId: string,
  seasonId: string,
): Promise<StandingsRow[]> {
  const { data: standingsRows, error: standingsError } = await supabase
    .from('standings')
    .select(
      'position, played, won, drawn, lost, goals_for, goals_against, goal_diff, points, total_fantapoints, team_id',
    )
    .eq('competition_id', competitionId)
    .order('position', { ascending: true });

  if (standingsError) {
    throw new Error(`Impossibile leggere la classifica: ${standingsError.message}`);
  }

  const teamIds = standingsRows.map((row) => row.team_id);

  if (teamIds.length === 0) {
    return [];
  }

  const [teamsResult, branding] = await Promise.all([
    supabase.from('teams').select('id, canonical_name, slug').in('id', teamIds),
    getTeamBranding(supabase, seasonId, teamIds),
  ]);

  if (teamsResult.error) {
    throw new Error(`Impossibile leggere le squadre: ${teamsResult.error.message}`);
  }

  const teamsById = new Map(teamsResult.data.map((team) => [team.id, team]));

  return standingsRows.map((row) => {
    const team = teamsById.get(row.team_id);

    return {
      position: row.position,
      teamName: team?.canonical_name ?? '—',
      teamSlug: team?.slug ?? '',
      jerseyUrl: brandingFor(branding, row.team_id).jerseyUrl,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.goals_for,
      goalsAgainst: row.goals_against,
      goalDiff: row.goal_diff,
      points: row.points,
      totalFantapoints: row.total_fantapoints,
    };
  });
}

export type MatchdayBounds = { min: number; max: number };

export async function getMatchdayBounds(
  supabase: TypedSupabaseClient,
  competitionId: string,
): Promise<MatchdayBounds | null> {
  const { data, error } = await supabase
    .from('matchdays')
    .select('number')
    .eq('competition_id', competitionId)
    .order('number', { ascending: true });

  if (error) {
    throw new Error(`Impossibile leggere le giornate: ${error.message}`);
  }

  const first = data[0];
  const last = data[data.length - 1];

  if (!first || !last) {
    return null;
  }

  return { min: first.number, max: last.number };
}

type MatchdayRange = { from: number; to: number };

type TeamAccumulator = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  totalFantapoints: number;
  goalsFor: number;
  goalsAgainst: number;
  // Le partite di Coppa fase gironi non hanno un calendario xlsx sorgente
  // (solo formazioni + classifica finale, vedi pilot-import-2025-26.ts):
  // home_goals/away_goals restano null per quelle. Se anche una sola partita
  // nel range non ha i gol, meglio mostrare Gf/Gs assenti per l'intera riga
  // che un parziale silenzioso.
  goalsComplete: boolean;
};

// Classifica calcolata al volo dalle partite, per un intervallo di giornate
// (non lo snapshot di `standings`, che è sempre e solo il finale importato —
// vedi AGENTS.md). Gf/Gs/Dr vengono dai gol per singola partita in
// `matches.home_goals/away_goals` (colonna "risultato" del calendario xlsx,
// aggiunta dopo aver verificato che la somma stagionale torna con lo
// snapshot in `standings` — vedi calendar.test.ts). Restano null solo se la
// competizione non ha questi dati (es. Coppa fase gironi, senza calendario
// sorgente) — mai uno zero fabbricato.
export async function getStandingsForRange(
  supabase: TypedSupabaseClient,
  competitionId: string,
  range: MatchdayRange,
  seasonId: string,
): Promise<StandingsRow[]> {
  const { data: matchdays, error: matchdaysError } = await supabase
    .from('matchdays')
    .select('id')
    .eq('competition_id', competitionId)
    .gte('number', range.from)
    .lte('number', range.to);

  if (matchdaysError) {
    throw new Error(`Impossibile leggere le giornate: ${matchdaysError.message}`);
  }

  const matchdayIds = matchdays.map((matchday) => matchday.id);

  if (matchdayIds.length === 0) {
    return [];
  }

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select(
      'home_team_id, away_team_id, home_score, away_score, home_result_points, away_result_points, home_goals, away_goals',
    )
    .in('matchday_id', matchdayIds);

  if (matchesError) {
    throw new Error(`Impossibile leggere le partite: ${matchesError.message}`);
  }

  const accumulators = new Map<string, TeamAccumulator>();

  function ensure(teamId: string): TeamAccumulator {
    const existing = accumulators.get(teamId);
    if (existing) {
      return existing;
    }
    const created: TeamAccumulator = {
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      points: 0,
      totalFantapoints: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalsComplete: true,
    };
    accumulators.set(teamId, created);
    return created;
  }

  for (const match of matches) {
    const home = ensure(match.home_team_id);
    const away = ensure(match.away_team_id);

    home.played += 1;
    away.played += 1;
    home.points += match.home_result_points ?? 0;
    away.points += match.away_result_points ?? 0;
    home.totalFantapoints += match.home_score ?? 0;
    away.totalFantapoints += match.away_score ?? 0;

    // V/N/P dai punti 3/1/0 già derivati in ingestion (non dal confronto
    // diretto dei fantavoto): i punti incorporano eventuali modificatori di
    // regolamento (es. difesa), il fantavoto grezzo no.
    if (match.home_result_points === 3) {
      home.won += 1;
      away.lost += 1;
    } else if (match.home_result_points === 1) {
      home.drawn += 1;
      away.drawn += 1;
    } else if (match.home_result_points === 0) {
      away.won += 1;
      home.lost += 1;
    }

    if (match.home_goals !== null && match.away_goals !== null) {
      home.goalsFor += match.home_goals;
      home.goalsAgainst += match.away_goals;
      away.goalsFor += match.away_goals;
      away.goalsAgainst += match.home_goals;
    } else {
      home.goalsComplete = false;
      away.goalsComplete = false;
    }
  }

  const teamIds = [...accumulators.keys()];

  if (teamIds.length === 0) {
    return [];
  }

  const [teamsResult, branding] = await Promise.all([
    supabase.from('teams').select('id, canonical_name, slug').in('id', teamIds),
    getTeamBranding(supabase, seasonId, teamIds),
  ]);

  if (teamsResult.error) {
    throw new Error(`Impossibile leggere le squadre: ${teamsResult.error.message}`);
  }

  const teamsById = new Map(teamsResult.data.map((team) => [team.id, team]));

  const rows: StandingsRow[] = [...accumulators.entries()].map(([teamId, accumulator]) => {
    const team = teamsById.get(teamId);
    const goalsFor = accumulator.goalsComplete ? accumulator.goalsFor : null;
    const goalsAgainst = accumulator.goalsComplete ? accumulator.goalsAgainst : null;

    return {
      position: null,
      teamName: team?.canonical_name ?? '—',
      teamSlug: team?.slug ?? '',
      jerseyUrl: brandingFor(branding, teamId).jerseyUrl,
      played: accumulator.played,
      won: accumulator.won,
      drawn: accumulator.drawn,
      lost: accumulator.lost,
      goalsFor,
      goalsAgainst,
      goalDiff: goalsFor !== null && goalsAgainst !== null ? goalsFor - goalsAgainst : null,
      points: accumulator.points,
      totalFantapoints: accumulator.totalFantapoints,
    };
  });

  rows.sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || (b.totalFantapoints ?? 0) - (a.totalFantapoints ?? 0));
  rows.forEach((row, index) => {
    row.position = index + 1;
  });

  return rows;
}
