// apps/web/lib/queries/statistiche.ts
//
// Query per la pagina Statistiche (piano, sezione 10 + mockup
// StatisticheView): confronto punti/fantapunti tra due squadre nella stessa
// competizione. "Punti" è la somma cumulativa di home/away_result_points
// giornata per giornata; "Fantapunti" è home/away_score preso così com'è,
// SENZA somma — stessa nota già in sezione 6 del piano su `matches`, che
// basta da sola per questa pagina (nessuna tabella nuova).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';
import { getTeamBranding, brandingFor } from './team-branding';

type TypedSupabaseClient = SupabaseClient<Database>;

export type ComparableTeam = { teamId: string; slug: string; name: string; logoUrl: string | null };

// Squadre selezionabili nei due TeamPicker: quelle con almeno una riga
// standings in questa competizione, stesso insieme di getStandings. Slug
// (non l'id) è quanto finisce nell'URL (?squadra1=/&squadra2=), coerente con
// CompetitionSwitcher che usa lo slug della competizione, non il suo id.
export async function getComparableTeams(
  supabase: TypedSupabaseClient,
  competitionId: string,
  seasonId: string,
): Promise<ComparableTeam[]> {
  const { data: standingsRows, error: standingsError } = await supabase
    .from('standings')
    .select('team_id')
    .eq('competition_id', competitionId);

  if (standingsError) {
    throw new Error(`Impossibile leggere la classifica: ${standingsError.message}`);
  }

  const teamIds = [...new Set(standingsRows.map((row) => row.team_id))];
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

  return teamIds
    .map((teamId) => ({
      teamId,
      slug: teamsById.get(teamId)?.slug ?? teamId,
      name: brandingFor(branding, teamId).displayName ?? teamsById.get(teamId)?.canonical_name ?? '—',
      logoUrl: brandingFor(branding, teamId).logoUrl,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type HeadToHeadPoint = {
  matchdayNumber: number;
  team1Points: number | null;
  team2Points: number | null;
  team1Fantapoints: number | null;
  team2Fantapoints: number | null;
};

export async function getHeadToHeadSeries(
  supabase: TypedSupabaseClient,
  competitionId: string,
  team1Id: string,
  team2Id: string,
): Promise<HeadToHeadPoint[]> {
  const { data: matchdays, error: matchdaysError } = await supabase
    .from('matchdays')
    .select('id, number')
    .eq('competition_id', competitionId)
    .order('number', { ascending: true });

  if (matchdaysError) {
    throw new Error(`Impossibile leggere le giornate: ${matchdaysError.message}`);
  }
  if (matchdays.length === 0) {
    return [];
  }

  const matchdayIds = matchdays.map((matchday) => matchday.id);
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('matchday_id, home_team_id, away_team_id, home_score, away_score, home_result_points, away_result_points')
    .in('matchday_id', matchdayIds)
    .or(`home_team_id.in.(${team1Id},${team2Id}),away_team_id.in.(${team1Id},${team2Id})`);

  if (matchesError) {
    throw new Error(`Impossibile leggere le partite: ${matchesError.message}`);
  }

  // matches ?? []: TS non ristringe la nullabilità attraverso il confine di
  // una funzione annidata (rowFor) anche dopo il controllo di matchesError.
  const safeMatches = matches ?? [];

  // Per giornata, la riga (punti/fantavoto) di ciascuna delle due squadre —
  // una squadra è sempre in una sola riga (home o away) di una giornata, mai
  // entrambe (si affrontano squadre diverse ogni turno di un girone).
  function rowFor(matchdayId: string, teamId: string) {
    return safeMatches.find(
      (match) => match.matchday_id === matchdayId && (match.home_team_id === teamId || match.away_team_id === teamId),
    );
  }

  let team1Cumulative = 0;
  let team2Cumulative = 0;
  let team1Played = false;
  let team2Played = false;

  return matchdays.map((matchday) => {
    const team1Row = rowFor(matchday.id, team1Id);
    const team2Row = rowFor(matchday.id, team2Id);

    let team1Fantapoints: number | null = null;
    if (team1Row) {
      const isHome = team1Row.home_team_id === team1Id;
      team1Cumulative += (isHome ? team1Row.home_result_points : team1Row.away_result_points) ?? 0;
      team1Fantapoints = (isHome ? team1Row.home_score : team1Row.away_score) ?? null;
      team1Played = true;
    }

    let team2Fantapoints: number | null = null;
    if (team2Row) {
      const isHome = team2Row.home_team_id === team2Id;
      team2Cumulative += (isHome ? team2Row.home_result_points : team2Row.away_result_points) ?? 0;
      team2Fantapoints = (isHome ? team2Row.home_score : team2Row.away_score) ?? null;
      team2Played = true;
    }

    return {
      matchdayNumber: matchday.number,
      team1Points: team1Played ? team1Cumulative : null,
      team2Points: team2Played ? team2Cumulative : null,
      team1Fantapoints,
      team2Fantapoints,
    };
  });
}
