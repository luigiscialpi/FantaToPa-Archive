// packages/ingestion/scripts/verify-rivalry-fallback.ts
//
// Diagnostica read-only: elenca le partite 1vs1 (escluse Coppa Gironi
// "formula uno") con score presente ma home/away_result_points null.
// Questi sono i casi dove la home usa il fallback score->V/N/P in
// getRivalryHighlight.
//
// Uso:
//   dotenv -e .env.local -- tsx packages/ingestion/scripts/verify-rivalry-fallback.ts

import { createIngestionClient } from '../lib/supabase-client.js';

type QueryPageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type UntypedClient = {
  from: <T extends Record<string, unknown>>(table: string) => {
    select: (columns: string) => {
      range: (from: number, to: number) => Promise<QueryPageResult<T>>;
    };
  };
};

type SeasonRow = { id: string; slug: string };
type CompetitionRow = {
  id: string;
  slug: string;
  kind_code: string;
  format_code: string;
  season_id: string;
};
type MatchdayRow = { id: string; number: number; competition_id: string };
type TeamRow = { id: string; canonical_name: string };
type MatchRow = {
  matchday_id: string;
  home_team_id: string;
  away_team_id: string | null;
  home_result_points: number | null;
  away_result_points: number | null;
  home_score: number | null;
  away_score: number | null;
};

type ImpactedMatch = {
  season: string;
  competition: string;
  matchday: number;
  homeTeamName: string;
  awayTeamName: string;
  score: string;
  points: string;
};

async function fetchAllRows<T extends Record<string, unknown>>(
  table: string,
  select: string,
): Promise<T[]> {
  const client = createIngestionClient() as unknown as UntypedClient;
  const rows: T[] = [];
  let from = 0;
  const step = 1000;

  while (true) {
    const { data, error } = await client.from<T>(table).select(select).range(from, from + step - 1);
    if (error) throw new Error(`Errore lettura ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < step) break;
    from += step;
  }

  return rows;
}

async function main() {
  const [seasons, competitions, matchdays, teams, matches] = await Promise.all([
    fetchAllRows<SeasonRow>('seasons', 'id, slug'),
    fetchAllRows<CompetitionRow>('competitions', 'id, slug, kind_code, format_code, season_id'),
    fetchAllRows<MatchdayRow>('matchdays', 'id, number, competition_id'),
    fetchAllRows<TeamRow>('teams', 'id, canonical_name'),
    fetchAllRows<MatchRow>(
      'matches',
      'matchday_id, home_team_id, away_team_id, home_result_points, away_result_points, home_score, away_score',
    ),
  ]);

  const seasonById = new Map(seasons.map((season) => [season.id, season.slug]));
  const competitionById = new Map(competitions.map((competition) => [competition.id, competition]));
  const matchdayById = new Map(matchdays.map((matchday) => [matchday.id, matchday]));
  const teamById = new Map(teams.map((team) => [team.id, team.canonical_name]));

  const impacted: ImpactedMatch[] = [];
  const countByCompetition = new Map<string, number>();

  for (const match of matches) {
    if (!match.away_team_id) continue;

    const matchday = matchdayById.get(match.matchday_id);
    if (!matchday) continue;

    const competition = competitionById.get(matchday.competition_id);
    if (!competition) continue;

    const isCoppaGironi = competition.kind_code.startsWith('coppa') && competition.format_code === 'gironi';
    if (isCoppaGironi) continue;

    if (match.home_score === null || match.away_score === null) continue;
    if (match.home_result_points !== null && match.away_result_points !== null) continue;

    const seasonSlug = seasonById.get(competition.season_id) ?? '??';
    const homeTeamName = teamById.get(match.home_team_id) ?? match.home_team_id;
    const awayTeamName = teamById.get(match.away_team_id) ?? match.away_team_id;

    impacted.push({
      season: seasonSlug,
      competition: competition.slug,
      matchday: matchday.number,
      homeTeamName,
      awayTeamName,
      score: `${match.home_score}-${match.away_score}`,
      points: `${match.home_result_points ?? 'null'}-${match.away_result_points ?? 'null'}`,
    });

    const key = `${seasonSlug} | ${competition.slug}`;
    countByCompetition.set(key, (countByCompetition.get(key) ?? 0) + 1);
  }

  impacted.sort(
    (a, b) =>
      a.season.localeCompare(b.season) || a.competition.localeCompare(b.competition) || a.matchday - b.matchday,
  );

  console.log('=== Conteggio per competizione (partite impattate) ===');
  for (const [key, value] of [...countByCompetition.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${key}: ${value}`);
  }

  console.log('\n=== Elenco partite impattate ===');
  for (const row of impacted) {
    console.log(
      `${row.season} | ${row.competition} | g${row.matchday} | ${row.homeTeamName} ${row.score} ${row.awayTeamName} | pts ${row.points}`,
    );
  }

  console.log(`\nTotale partite impattate: ${impacted.length}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Diagnostica fallita: ${message}`);
  process.exitCode = 1;
});