// apps/web/lib/queries/calendario.ts
//
// Layer di query per Calendario/Risultati: stesso pattern di classifica.ts
// (AGENTS.md vieta query Supabase nei componenti React). Niente embed
// postgrest — due query separate (matches, teams) + merge in memoria, come
// in getStandings.
//
// Nessun campo data: le fonti xlsx non riportano una data per partita, solo
// il numero di giornata (vedi adapters/xlsx/calendar.ts) — "Calendario" qui
// è quindi risultati raggruppati per giornata, non un calendario per date.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';
import { getTeamBranding, brandingFor, type TeamBranding } from './team-branding';

type TypedSupabaseClient = SupabaseClient<Database>;

export type MatchRow = {
  id: string;
  homeTeamName: string;
  // null per il blocco "solo" di un girone con numero dispari di squadre
  // (vedi adapters/xlsx/lineup.ts): quella giornata la squadra home non ha
  // avversario.
  awayTeamName: string | null;
  homeJerseyUrl: string | null;
  awayJerseyUrl: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
};

export type MatchdayGroup = {
  id: string;
  number: number;
  label: string | null;
  matches: MatchRow[];
};

export async function getCalendario(
  supabase: TypedSupabaseClient,
  competitionId: string,
  seasonId: string,
): Promise<MatchdayGroup[]> {
  const { data: matchdaysRows, error: matchdaysError } = await supabase
    .from('matchdays')
    .select('id, number, label')
    .eq('competition_id', competitionId)
    .order('number', { ascending: true });

  if (matchdaysError) {
    throw new Error(`Impossibile leggere le giornate: ${matchdaysError.message}`);
  }

  const matchdayIds = matchdaysRows.map((matchday) => matchday.id);
  const matchesByMatchday = new Map<string, MatchRow[]>();

  if (matchdayIds.length > 0) {
    const { data: matchesRows, error: matchesError } = await supabase
      .from('matches')
      .select('id, matchday_id, home_team_id, away_team_id, home_score, away_score, home_goals, away_goals')
      .in('matchday_id', matchdayIds)
      // Senza order esplicito l'ordine delle righe non è garantito e può
      // cambiare da una query all'altra (visto concretamente: un UPDATE su
      // una riga la spostava in fondo al suo gruppo giornata). `id` non ha
      // un significato per l'utente, ma è quantomeno stabile nel tempo.
      .order('id', { ascending: true });

    if (matchesError) {
      throw new Error(`Impossibile leggere le partite: ${matchesError.message}`);
    }

    const teamIds = [
      ...new Set(
        matchesRows.flatMap((match) => [match.home_team_id, match.away_team_id]).filter((id): id is string => id !== null),
      ),
    ];
    const teamNameById = new Map<string, string>();
    let branding = new Map<string, TeamBranding>();

    if (teamIds.length > 0) {
      const [teamsResult, brandingResult] = await Promise.all([
        supabase.from('teams').select('id, canonical_name').in('id', teamIds),
        getTeamBranding(supabase, seasonId, teamIds),
      ]);

      if (teamsResult.error) {
        throw new Error(`Impossibile leggere le squadre: ${teamsResult.error.message}`);
      }

      for (const team of teamsResult.data) {
        teamNameById.set(team.id, team.canonical_name);
      }

      branding = brandingResult;
    }

    for (const match of matchesRows) {
      const awayBranding = match.away_team_id ? brandingFor(branding, match.away_team_id) : null;
      const row: MatchRow = {
        id: match.id,
        homeTeamName: brandingFor(branding, match.home_team_id).displayName ?? teamNameById.get(match.home_team_id) ?? '—',
        awayTeamName: match.away_team_id
          ? (awayBranding?.displayName ?? teamNameById.get(match.away_team_id) ?? '—')
          : null,
        homeJerseyUrl: brandingFor(branding, match.home_team_id).jerseyUrl,
        awayJerseyUrl: awayBranding?.jerseyUrl ?? null,
        homeScore: match.home_score,
        awayScore: match.away_score,
        homeGoals: match.home_goals,
        awayGoals: match.away_goals,
      };
      const bucket = matchesByMatchday.get(match.matchday_id);
      if (bucket) {
        bucket.push(row);
      } else {
        matchesByMatchday.set(match.matchday_id, [row]);
      }
    }
  }

  return matchdaysRows.map((matchday) => ({
    id: matchday.id,
    number: matchday.number,
    label: matchday.label,
    matches: matchesByMatchday.get(matchday.id) ?? [],
  }));
}

export type GironeTeamResult = {
  matchId: string;
  teamName: string;
  jerseyUrl: string | null;
  score: number | null;
};

export type GironeMatchdayGroup = {
  id: string;
  number: number;
  label: string | null;
  teams: GironeTeamResult[];
};

// Coppa Girone A/B (format_code 'gironi'): "formula uno" come in
// getGironeFormazioni, non sfide 1v1 — ogni giornata è una classifica di
// giornata (punteggi di tutte le squadre), non un elenco di partite
// home/away.
export async function getGironeCalendario(
  supabase: TypedSupabaseClient,
  competitionId: string,
  seasonId: string,
): Promise<GironeMatchdayGroup[]> {
  const matchdays = await getCalendario(supabase, competitionId, seasonId);

  return matchdays.map((matchday) => {
    const teams: GironeTeamResult[] = matchday.matches.flatMap((match) => {
      const home: GironeTeamResult = {
        matchId: match.id,
        teamName: match.homeTeamName,
        jerseyUrl: match.homeJerseyUrl,
        score: match.homeScore,
      };
      if (!match.awayTeamName) return [home];
      const away: GironeTeamResult = {
        matchId: match.id,
        teamName: match.awayTeamName,
        jerseyUrl: match.awayJerseyUrl,
        score: match.awayScore,
      };
      return [home, away];
    });
    teams.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
    return { id: matchday.id, number: matchday.number, label: matchday.label, teams };
  });
}
