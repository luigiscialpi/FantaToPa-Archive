// apps/web/lib/queries/home.ts
//
// Query per la Home (piano, sezione 10): pannello squadra personale, vetrina
// generale, galleria stagioni. Stesso pattern di classifica.ts/calendario.ts
// (AGENTS.md: niente query Supabase nei componenti React, niente embed
// postgrest — query separate + merge in memoria).
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';
import { getMatchdayBounds } from './classifica';
import { getSeasons, type SeasonOption } from './seasons';
import { getTeamBranding, brandingFor } from './team-branding';

type TypedSupabaseClient = SupabaseClient<Database>;

// Solo queste due fasi assegnano davvero un titolo: coppa_girone/
// coppa_spareggio sono fasi di qualificazione, non l'ultimo atto della Coppa.
const TITLE_KIND_CODES = ['campionato', 'coppa_fase_finale'] as const;

export type TitleCounts = { campionati: number; coppe: number };

// cache(): sia la Home (Bacheca personale) sia getMostTitledTeam (vetrina
// generale) la invocano nella stessa render request — stesso motivo di
// getSeasons/getSessionState (AGENTS.md).
export const getAllTimeTitleCounts = cache(async (supabase: TypedSupabaseClient): Promise<Map<string, TitleCounts>> => {
  const { data: competitions, error: competitionsError } = await supabase
    .from('competitions')
    .select('id, kind_code')
    .in('kind_code', TITLE_KIND_CODES);

  if (competitionsError) {
    throw new Error(`Impossibile leggere le competizioni: ${competitionsError.message}`);
  }

  const counts = new Map<string, TitleCounts>();
  const competitionIds = competitions.map((competition) => competition.id);

  if (competitionIds.length === 0) {
    return counts;
  }

  const kindByCompetition = new Map(competitions.map((competition) => [competition.id, competition.kind_code]));

  const { data: winners, error: winnersError } = await supabase
    .from('standings')
    .select('team_id, competition_id')
    .eq('position', 1)
    .in('competition_id', competitionIds);

  if (winnersError) {
    throw new Error(`Impossibile leggere i vincitori: ${winnersError.message}`);
  }

  for (const winner of winners) {
    const kind = kindByCompetition.get(winner.competition_id);
    const existing = counts.get(winner.team_id) ?? { campionati: 0, coppe: 0 };
    if (kind === 'campionato') {
      existing.campionati += 1;
    } else if (kind === 'coppa_fase_finale') {
      existing.coppe += 1;
    }
    counts.set(winner.team_id, existing);
  }

  return counts;
});

export async function getMostTitledTeam(
  supabase: TypedSupabaseClient,
): Promise<{ teamName: string; titles: TitleCounts } | null> {
  const counts = await getAllTimeTitleCounts(supabase);

  let topTeamId: string | null = null;
  let topTitles: TitleCounts | null = null;
  for (const [teamId, titles] of counts) {
    const topTotal = topTitles ? topTitles.campionati + topTitles.coppe : -1;
    if (titles.campionati + titles.coppe > topTotal) {
      topTeamId = teamId;
      topTitles = titles;
    }
  }

  if (!topTeamId || !topTitles) {
    return null;
  }

  const { data: team, error } = await supabase.from('teams').select('canonical_name').eq('id', topTeamId).maybeSingle();
  if (error) {
    throw new Error(`Impossibile leggere la squadra: ${error.message}`);
  }

  return { teamName: team?.canonical_name ?? '—', titles: topTitles };
}

export type RivalryHighlight = {
  opponentName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
};

export async function getRivalryHighlight(supabase: TypedSupabaseClient, teamId: string): Promise<RivalryHighlight | null> {
  const [homeResult, awayResult] = await Promise.all([
    supabase.from('matches').select('away_team_id, home_result_points').eq('home_team_id', teamId),
    supabase.from('matches').select('home_team_id, away_result_points').eq('away_team_id', teamId),
  ]);

  if (homeResult.error) {
    throw new Error(`Impossibile leggere le partite: ${homeResult.error.message}`);
  }
  if (awayResult.error) {
    throw new Error(`Impossibile leggere le partite: ${awayResult.error.message}`);
  }

  type Tally = { played: number; won: number; drawn: number; lost: number };
  const byOpponent = new Map<string, Tally>();

  function tally(opponentId: string, points: number | null) {
    const entry = byOpponent.get(opponentId) ?? { played: 0, won: 0, drawn: 0, lost: 0 };
    entry.played += 1;
    if (points === 3) entry.won += 1;
    else if (points === 1) entry.drawn += 1;
    else if (points === 0) entry.lost += 1;
    byOpponent.set(opponentId, entry);
  }

  for (const match of homeResult.data) {
    tally(match.away_team_id, match.home_result_points);
  }
  for (const match of awayResult.data) {
    tally(match.home_team_id, match.away_result_points);
  }

  let topOpponentId: string | null = null;
  let topTally: Tally | null = null;
  for (const [opponentId, entry] of byOpponent) {
    if (!topTally || entry.played > topTally.played) {
      topOpponentId = opponentId;
      topTally = entry;
    }
  }

  if (!topOpponentId || !topTally) {
    return null;
  }

  const { data: opponent, error: opponentError } = await supabase
    .from('teams')
    .select('canonical_name')
    .eq('id', topOpponentId)
    .maybeSingle();

  if (opponentError) {
    throw new Error(`Impossibile leggere la squadra avversaria: ${opponentError.message}`);
  }

  return { opponentName: opponent?.canonical_name ?? '—', ...topTally };
}

export type MatchHighlight = {
  teamName: string;
  opponentName: string;
  score: number;
  seasonSlug: string;
  seasonLabel: string;
  competitionSlug: string;
  matchdayNumber: number;
};

type RawMatch = {
  matchday_id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

// Risolve giornata → competizione → stagione + nome avversario per UNA
// partita già scelta (record migliore/peggiore, ecc.): chiamata solo 1-2
// volte per stat, mai su liste intere — niente bisogno di ottimizzare i
// round-trip a questa scala (sezione 3 del piano).
async function enrichMatch(
  supabase: TypedSupabaseClient,
  match: RawMatch,
  focusTeamId: string,
): Promise<MatchHighlight | null> {
  const isHome = match.home_team_id === focusTeamId;
  const opponentId = isHome ? match.away_team_id : match.home_team_id;
  const score = isHome ? match.home_score : match.away_score;

  if (score === null) {
    return null;
  }

  const { data: matchday, error: matchdayError } = await supabase
    .from('matchdays')
    .select('number, competition_id')
    .eq('id', match.matchday_id)
    .maybeSingle();

  if (matchdayError) {
    throw new Error(`Impossibile leggere la giornata: ${matchdayError.message}`);
  }
  if (!matchday) {
    return null;
  }

  const [competitionResult, teamsResult] = await Promise.all([
    supabase.from('competitions').select('season_id, slug').eq('id', matchday.competition_id).maybeSingle(),
    supabase.from('teams').select('id, canonical_name').in('id', [focusTeamId, opponentId]),
  ]);

  if (competitionResult.error) {
    throw new Error(`Impossibile leggere la competizione: ${competitionResult.error.message}`);
  }
  if (teamsResult.error) {
    throw new Error(`Impossibile leggere le squadre: ${teamsResult.error.message}`);
  }
  if (!competitionResult.data) {
    return null;
  }

  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('slug, label')
    .eq('id', competitionResult.data.season_id)
    .maybeSingle();

  if (seasonError) {
    throw new Error(`Impossibile leggere la stagione: ${seasonError.message}`);
  }

  const nameById = new Map(teamsResult.data.map((team) => [team.id, team.canonical_name]));

  return {
    teamName: nameById.get(focusTeamId) ?? '—',
    opponentName: nameById.get(opponentId) ?? '—',
    score,
    seasonSlug: season?.slug ?? '',
    seasonLabel: season?.label ?? '—',
    competitionSlug: competitionResult.data.slug ?? '',
    matchdayNumber: matchday.number,
  };
}

export async function getPersonalRecords(
  supabase: TypedSupabaseClient,
  teamId: string,
): Promise<{ best: MatchHighlight | null; worst: MatchHighlight | null }> {
  const selection = 'matchday_id, home_team_id, away_team_id, home_score, away_score';
  const [homeResult, awayResult] = await Promise.all([
    supabase.from('matches').select(selection).eq('home_team_id', teamId),
    supabase.from('matches').select(selection).eq('away_team_id', teamId),
  ]);

  if (homeResult.error) {
    throw new Error(`Impossibile leggere le partite: ${homeResult.error.message}`);
  }
  if (awayResult.error) {
    throw new Error(`Impossibile leggere le partite: ${awayResult.error.message}`);
  }

  const matches: RawMatch[] = [...homeResult.data, ...awayResult.data];
  let bestMatch: RawMatch | null = null;
  let bestScore = -Infinity;
  let worstMatch: RawMatch | null = null;
  let worstScore = Infinity;

  for (const match of matches) {
    const score = match.home_team_id === teamId ? match.home_score : match.away_score;
    if (score === null) continue;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = match;
    }
    if (score < worstScore) {
      worstScore = score;
      worstMatch = match;
    }
  }

  const [best, worst] = await Promise.all([
    bestMatch ? enrichMatch(supabase, bestMatch, teamId) : Promise.resolve(null),
    worstMatch ? enrichMatch(supabase, worstMatch, teamId) : Promise.resolve(null),
  ]);

  return { best, worst };
}

export type BiggestWin = MatchHighlight & { opponentScore: number };

export async function getLeagueRecords(
  supabase: TypedSupabaseClient,
): Promise<{ highestScore: MatchHighlight | null; biggestWin: BiggestWin | null }> {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('matchday_id, home_team_id, away_team_id, home_score, away_score');

  if (error) {
    throw new Error(`Impossibile leggere le partite: ${error.message}`);
  }

  let highestMatch: RawMatch | null = null;
  let highestTeamId: string | null = null;
  let highestScore = -Infinity;

  let biggestMatch: RawMatch | null = null;
  let biggestWinnerId: string | null = null;
  let biggestLoserScore = 0;
  let biggestMargin = -Infinity;

  for (const match of matches) {
    if (match.home_score !== null && match.home_score > highestScore) {
      highestScore = match.home_score;
      highestMatch = match;
      highestTeamId = match.home_team_id;
    }
    if (match.away_score !== null && match.away_score > highestScore) {
      highestScore = match.away_score;
      highestMatch = match;
      highestTeamId = match.away_team_id;
    }

    if (match.home_score !== null && match.away_score !== null) {
      const margin = Math.abs(match.home_score - match.away_score);
      if (margin > biggestMargin) {
        biggestMargin = margin;
        biggestMatch = match;
        const homeWon = match.home_score > match.away_score;
        biggestWinnerId = homeWon ? match.home_team_id : match.away_team_id;
        biggestLoserScore = homeWon ? match.away_score : match.home_score;
      }
    }
  }

  const [highestScoreHighlight, biggestWinHighlight] = await Promise.all([
    highestMatch && highestTeamId ? enrichMatch(supabase, highestMatch, highestTeamId) : Promise.resolve(null),
    biggestMatch && biggestWinnerId ? enrichMatch(supabase, biggestMatch, biggestWinnerId) : Promise.resolve(null),
  ]);

  return {
    highestScore: highestScoreHighlight,
    biggestWin: biggestWinHighlight ? { ...biggestWinHighlight, opponentScore: biggestLoserScore } : null,
  };
}

export type FieldedPlayer = { playerName: string; appearances: number };

// ponytail: conta le titolarità su TUTTE le lineup della squadra senza
// filtrare per stagione — oggi ne esiste una sola, quindi equivalente al
// conteggio "questa stagione". Quando esisterà una seconda stagione, prima
// di fidarsi ancora di questo conteggio va deciso se scendere a livello di
// singola stagione (lineups -> matches -> matchdays -> competitions.
// season_id) o sostituire la funzione con la vera metrica di fedeltà
// multi-stagione già in sezione 10 del piano ("chi è rimasto in rosa più
// stagioni consecutive").
export async function getMostFieldedPlayer(supabase: TypedSupabaseClient, teamId: string): Promise<FieldedPlayer | null> {
  const { data: lineups, error: lineupsError } = await supabase.from('lineups').select('id').eq('team_id', teamId);
  if (lineupsError) {
    throw new Error(`Impossibile leggere le formazioni: ${lineupsError.message}`);
  }

  const lineupIds = lineups.map((lineup) => lineup.id);
  if (lineupIds.length === 0) {
    return null;
  }

  const { data: lineupPlayers, error: lineupPlayersError } = await supabase
    .from('lineup_players')
    .select('player_id')
    .in('lineup_id', lineupIds)
    .eq('slot', 'titolare');

  if (lineupPlayersError) {
    throw new Error(`Impossibile leggere i titolari: ${lineupPlayersError.message}`);
  }

  const appearancesByPlayer = new Map<string, number>();
  for (const row of lineupPlayers) {
    appearancesByPlayer.set(row.player_id, (appearancesByPlayer.get(row.player_id) ?? 0) + 1);
  }

  let topPlayerId: string | null = null;
  let topAppearances = 0;
  for (const [playerId, appearances] of appearancesByPlayer) {
    if (appearances > topAppearances) {
      topAppearances = appearances;
      topPlayerId = playerId;
    }
  }

  if (!topPlayerId) {
    return null;
  }

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('canonical_name')
    .eq('id', topPlayerId)
    .maybeSingle();

  if (playerError) {
    throw new Error(`Impossibile leggere il giocatore: ${playerError.message}`);
  }

  return { playerName: player?.canonical_name ?? '—', appearances: topAppearances };
}

export type LatestMatchdayResult = {
  homeTeamName: string;
  awayTeamName: string;
  homeJerseyUrl: string | null;
  awayJerseyUrl: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type LatestMatchday = { number: number; matches: LatestMatchdayResult[] };

export async function getLatestMatchdayResults(
  supabase: TypedSupabaseClient,
  competitionId: string,
  seasonId: string,
): Promise<LatestMatchday | null> {
  const bounds = await getMatchdayBounds(supabase, competitionId);
  if (!bounds) {
    return null;
  }

  const { data: matchday, error: matchdayError } = await supabase
    .from('matchdays')
    .select('id, number')
    .eq('competition_id', competitionId)
    .eq('number', bounds.max)
    .maybeSingle();

  if (matchdayError) {
    throw new Error(`Impossibile leggere la giornata: ${matchdayError.message}`);
  }
  if (!matchday) {
    return null;
  }

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, home_score, away_score')
    .eq('matchday_id', matchday.id);

  if (matchesError) {
    throw new Error(`Impossibile leggere le partite: ${matchesError.message}`);
  }

  const teamIds = [...new Set(matches.flatMap((match) => [match.home_team_id, match.away_team_id]))];
  if (teamIds.length === 0) {
    return { number: matchday.number, matches: [] };
  }

  const [teamsResult, branding] = await Promise.all([
    supabase.from('teams').select('id, canonical_name').in('id', teamIds),
    getTeamBranding(supabase, seasonId, teamIds),
  ]);

  if (teamsResult.error) {
    throw new Error(`Impossibile leggere le squadre: ${teamsResult.error.message}`);
  }

  const nameById = new Map(teamsResult.data.map((team) => [team.id, team.canonical_name]));

  return {
    number: matchday.number,
    matches: matches.map((match) => ({
      homeTeamName: nameById.get(match.home_team_id) ?? '—',
      awayTeamName: nameById.get(match.away_team_id) ?? '—',
      homeJerseyUrl: brandingFor(branding, match.home_team_id).jerseyUrl,
      awayJerseyUrl: brandingFor(branding, match.away_team_id).jerseyUrl,
      homeScore: match.home_score,
      awayScore: match.away_score,
    })),
  };
}

export type SeasonGalleryEntry = {
  id: string;
  slug: string;
  label: string;
  inProgress: boolean;
  championName: string | null;
};

export async function getSeasonGallery(supabase: TypedSupabaseClient): Promise<SeasonGalleryEntry[]> {
  const seasons: SeasonOption[] = await getSeasons(supabase);
  if (seasons.length === 0) {
    return [];
  }

  const { data: competitions, error: competitionsError } = await supabase
    .from('competitions')
    .select('id, season_id')
    .eq('kind_code', 'campionato')
    .in(
      'season_id',
      seasons.map((season) => season.id),
    );

  if (competitionsError) {
    throw new Error(`Impossibile leggere le competizioni: ${competitionsError.message}`);
  }

  const competitionIdBySeason = new Map(competitions.map((competition) => [competition.season_id, competition.id]));
  const competitionIds = competitions.map((competition) => competition.id);

  const winnerTeamIdByCompetition = new Map<string, string>();
  const teamNameById = new Map<string, string>();

  if (competitionIds.length > 0) {
    const { data: winners, error: winnersError } = await supabase
      .from('standings')
      .select('team_id, competition_id')
      .eq('position', 1)
      .in('competition_id', competitionIds);

    if (winnersError) {
      throw new Error(`Impossibile leggere i vincitori: ${winnersError.message}`);
    }

    for (const winner of winners) {
      winnerTeamIdByCompetition.set(winner.competition_id, winner.team_id);
    }

    const winnerTeamIds = [...new Set(winners.map((winner) => winner.team_id))];
    if (winnerTeamIds.length > 0) {
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, canonical_name')
        .in('id', winnerTeamIds);

      if (teamsError) {
        throw new Error(`Impossibile leggere le squadre: ${teamsError.message}`);
      }

      for (const team of teams) {
        teamNameById.set(team.id, team.canonical_name);
      }
    }
  }

  const today = new Date();

  return seasons.map((season) => {
    const competitionId = competitionIdBySeason.get(season.id);
    const winnerTeamId = competitionId ? winnerTeamIdByCompetition.get(competitionId) : undefined;
    const inProgress = season.endsOn === null || new Date(season.endsOn) > today;

    return {
      id: season.id,
      slug: season.slug,
      label: season.label,
      inProgress,
      championName: !inProgress && winnerTeamId ? (teamNameById.get(winnerTeamId) ?? null) : null,
    };
  });
}
