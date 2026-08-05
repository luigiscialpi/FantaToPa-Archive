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

// secondiCampionato/terziCampionato: solo Campionato, non Coppa — la fase
// finale di Coppa è un bracket a eliminazione diretta senza riga standings
// (vedi getCupFinalWinners), quindi non esiste un "2°/3° posto" derivabile
// allo stesso modo del vincitore (dedotto dalla finale).
export type TitleCounts = { campionati: number; coppe: number; secondiCampionato: number; terziCampionato: number };

// La fase finale di Coppa è un tabellone a eliminazione diretta: non produce
// mai una riga standings (non esiste una "classifica" per un bracket — verificato
// query alla mano, 0 righe in ogni stagione). "Chi ha vinto" si deduce
// dall'ultima giornata (numero più alto per quella competizione), che nei dati
// reali è sempre una finale a partita secca, mai andata/ritorno come quarti e
// semifinali. Condivisa da getAllTimeTitleCounts e getSeasonGallery: unica
// fonte per "vincitore Coppa", non duplicare altrove.
async function getCupFinalWinners(supabase: TypedSupabaseClient, cupCompetitionIds: string[]): Promise<Map<string, string>> {
  const winners = new Map<string, string>();
  if (cupCompetitionIds.length === 0) {
    return winners;
  }

  const { data: matchdays, error: matchdaysError } = await supabase
    .from('matchdays')
    .select('id, number, competition_id')
    .in('competition_id', cupCompetitionIds);

  if (matchdaysError) {
    throw new Error(`Impossibile leggere le giornate: ${matchdaysError.message}`);
  }

  const finalMatchdayByCompetition = new Map<string, { id: string; number: number }>();
  for (const matchday of matchdays) {
    const current = finalMatchdayByCompetition.get(matchday.competition_id);
    if (!current || matchday.number > current.number) {
      finalMatchdayByCompetition.set(matchday.competition_id, { id: matchday.id, number: matchday.number });
    }
  }

  const competitionByFinalMatchday = new Map(
    [...finalMatchdayByCompetition].map(([competitionId, matchday]) => [matchday.id, competitionId]),
  );
  const finalMatchdayIds = [...competitionByFinalMatchday.keys()];
  if (finalMatchdayIds.length === 0) {
    return winners;
  }

  const { data: finals, error: finalsError } = await supabase
    .from('matches')
    .select('matchday_id, home_team_id, away_team_id, home_score, away_score, home_result_points, away_result_points')
    .in('matchday_id', finalMatchdayIds);

  if (finalsError) {
    throw new Error(`Impossibile leggere le finali: ${finalsError.message}`);
  }

  for (const match of finals) {
    const competitionId = competitionByFinalMatchday.get(match.matchday_id);
    if (!competitionId) continue;
    // Una finale a eliminazione diretta ha sempre 2 squadre: un away_team_id
    // nullo qui sarebbe un'anomalia dati, non un caso atteso (a differenza
    // dei gironi) — nessun vincitore deducibile, si salta senza inventare.
    if (!match.away_team_id) continue;
    const homePoints = match.home_result_points ?? 0;
    const awayPoints = match.away_result_points ?? 0;
    // Mai osservato un pareggio punti in finale nei dati reali; a parità usa
    // il fantavoto come spareggio invece di assegnare sempre alla casa.
    const homeWins = homePoints !== awayPoints ? homePoints > awayPoints : (match.home_score ?? 0) >= (match.away_score ?? 0);
    winners.set(competitionId, homeWins ? match.home_team_id : match.away_team_id);
  }

  // Competizioni senza giornate reali (podio manuale da nota storica, es.
  // Coppa Lelle 2012-13/2014-15 prima dei mirror HTML): il vincitore viene
  // dalla riga standings position=1, stesso meccanismo del podio Campionato
  // manuale — nessun bracket da cui derivarlo.
  const missingCompetitionIds = cupCompetitionIds.filter((id) => !winners.has(id));
  if (missingCompetitionIds.length > 0) {
    const { data: manualWinners, error: manualWinnersError } = await supabase
      .from('standings')
      .select('competition_id, team_id')
      .eq('position', 1)
      .in('competition_id', missingCompetitionIds);

    if (manualWinnersError) {
      throw new Error(`Impossibile leggere il vincitore manuale: ${manualWinnersError.message}`);
    }

    for (const row of manualWinners) {
      winners.set(row.competition_id, row.team_id);
    }
  }

  return winners;
}

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

  function addTitle(teamId: string, kind: keyof TitleCounts) {
    const existing = counts.get(teamId) ?? { campionati: 0, coppe: 0, secondiCampionato: 0, terziCampionato: 0 };
    existing[kind] += 1;
    counts.set(teamId, existing);
  }

  const campionatoCompetitionIds = competitions.filter((competition) => competition.kind_code === 'campionato').map((competition) => competition.id);
  if (campionatoCompetitionIds.length > 0) {
    const { data: podiums, error: podiumsError } = await supabase
      .from('standings')
      .select('team_id, position')
      .in('position', [1, 2, 3])
      .in('competition_id', campionatoCompetitionIds);

    if (podiumsError) {
      throw new Error(`Impossibile leggere il podio: ${podiumsError.message}`);
    }

    for (const row of podiums) {
      if (row.position === 1) addTitle(row.team_id, 'campionati');
      else if (row.position === 2) addTitle(row.team_id, 'secondiCampionato');
      else if (row.position === 3) addTitle(row.team_id, 'terziCampionato');
    }
  }

  const coppaCompetitionIds = competitions.filter((competition) => competition.kind_code === 'coppa_fase_finale').map((competition) => competition.id);
  const cupWinners = await getCupFinalWinners(supabase, coppaCompetitionIds);
  for (const teamId of cupWinners.values()) {
    addTitle(teamId, 'coppe');
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

// cache(): getRivalryHighlight, getPersonalRecords e getLongestUnbeatenStreak la chiamano
// in parallelo nello stesso Promise.all — deduplica 6 round-trip Supabase in 2.
const getTeamMatches = cache(async (supabase: TypedSupabaseClient, teamId: string) => {
  const selection = 'matchday_id, home_team_id, away_team_id, home_result_points, away_result_points, home_score, away_score';
  const [home, away] = await Promise.all([
    supabase.from('matches').select(selection).eq('home_team_id', teamId),
    supabase.from('matches').select(selection).eq('away_team_id', teamId),
  ]);
  if (home.error) throw new Error(`Impossibile leggere le partite: ${home.error.message}`);
  if (away.error) throw new Error(`Impossibile leggere le partite: ${away.error.message}`);
  return { homeMatches: home.data, awayMatches: away.data };
});

export type RivalryHighlight = {
  opponentName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
};

export type OpponentRecord = {
  opponentName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
};

type Tally = { played: number; won: number; drawn: number; lost: number };

async function tallyOpponentMatches(
  supabase: TypedSupabaseClient,
  teamId: string,
): Promise<Map<string, Tally> | null> {
  const [{ homeMatches, awayMatches }, competitionsResult] = await Promise.all([
    getTeamMatches(supabase, teamId),
    supabase.from('competitions').select('id, kind_code, format_code'),
  ]);

  if (competitionsResult.error) {
    throw new Error(`Impossibile leggere le competizioni: ${competitionsResult.error.message}`);
  }

  if (homeMatches.length === 0 && awayMatches.length === 0) {
    return null;
  }

  const competitions = competitionsResult.data;
  const { data: matchdays, error: matchdaysError } = await supabase
    .from('matchdays')
    .select('id, competition_id')
    .in('competition_id', competitions.map((c) => c.id));
  if (matchdaysError) {
    throw new Error(`Impossibile leggere le giornate: ${matchdaysError.message}`);
  }

  const excludedCompetitionIds = new Set(
    competitions
      .filter((competition) => competition.kind_code.startsWith('coppa') && competition.format_code === 'gironi')
      .map((competition) => competition.id),
  );
  const includedMatchdayIds = new Set(
    matchdays.filter((matchday) => !excludedCompetitionIds.has(matchday.competition_id)).map((matchday) => matchday.id),
  );

  const byOpponent = new Map<string, Tally>();

  function resolvePoints(points: number | null, ownScore: number | null, opponentScore: number | null): number | null {
    if (points !== null) return points;
    if (ownScore === null || opponentScore === null) return null;
    if (ownScore > opponentScore) return 3;
    if (ownScore < opponentScore) return 0;
    return 1;
  }

  function tally(opponentId: string, points: number | null, ownScore: number | null, opponentScore: number | null) {
    const resolvedPoints = resolvePoints(points, ownScore, opponentScore);
    const entry = byOpponent.get(opponentId) ?? { played: 0, won: 0, drawn: 0, lost: 0 };
    entry.played += 1;
    if (resolvedPoints === 3) entry.won += 1;
    else if (resolvedPoints === 1) entry.drawn += 1;
    else if (resolvedPoints === 0) entry.lost += 1;
    byOpponent.set(opponentId, entry);
  }

  for (const match of homeMatches) {
    if (!includedMatchdayIds.has(match.matchday_id)) continue;
    if (!match.away_team_id) continue;
    tally(match.away_team_id, match.home_result_points, match.home_score, match.away_score);
  }
  for (const match of awayMatches) {
    if (!includedMatchdayIds.has(match.matchday_id)) continue;
    tally(match.home_team_id, match.away_result_points, match.away_score, match.home_score);
  }

  return byOpponent;
}

export async function getRivalryHighlight(supabase: TypedSupabaseClient, teamId: string): Promise<RivalryHighlight | null> {
  const byOpponent = await tallyOpponentMatches(supabase, teamId);
  if (!byOpponent) {
    return null;
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

export async function getOpponentRecords(
  supabase: TypedSupabaseClient,
  teamId: string,
): Promise<{ best: OpponentRecord[]; worst: OpponentRecord[] } | null> {
  const byOpponent = await tallyOpponentMatches(supabase, teamId);
  if (!byOpponent) {
    return null;
  }

  const opponentIds = [...byOpponent.keys()];
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, canonical_name')
    .in('id', opponentIds);
  if (teamsError) {
    throw new Error(`Impossibile leggere le squadre avversarie: ${teamsError.message}`);
  }

  const nameById = new Map(teams.map((team) => [team.id, team.canonical_name]));

  const recordsWithId = [...byOpponent].map(([opponentId, tally]) => ({
    opponentId,
    opponentName: nameById.get(opponentId) ?? '—',
    played: tally.played,
    won: tally.won,
    drawn: tally.drawn,
    lost: tally.lost,
  }));

  // "Migliori" prima, poi "peggiori" solo tra gli avversari rimanenti: un
  // avversario affrontato molto più spesso degli altri accumula sia più
  // vittorie sia più sconfitte in valore assoluto (es. "Biancoceleste") e
  // finirebbe in cima a entrambe le classifiche se calcolate in modo
  // indipendente. Punti stile classifica (3-1-0): i pareggi valgono meno
  // delle vittorie/sconfitte, non semplici conteggi di esiti.
  const points = (record: (typeof recordsWithId)[number]) => record.won * 3 + record.drawn;
  const pointsAgainst = (record: (typeof recordsWithId)[number]) => record.lost * 3 + record.drawn;
  const best = [...recordsWithId]
    .sort((a, b) => points(b) - points(a) || b.played - a.played)
    .slice(0, 3);
  const bestOpponentIds = new Set(best.map((record) => record.opponentId));
  const worst = recordsWithId
    .filter((record) => !bestOpponentIds.has(record.opponentId))
    .sort((a, b) => pointsAgainst(b) - pointsAgainst(a) || b.played - a.played)
    .slice(0, 3);

  return { best, worst };
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
  away_team_id: string | null;
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
  // Girone con numero dispari di squadre: nessun avversario quella giornata
  // (squadra "solo") — non è un record contro un avversario reale.
  if (!opponentId) {
    return null;
  }
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
  const { homeMatches, awayMatches } = await getTeamMatches(supabase, teamId);
  const matches: RawMatch[] = [...homeMatches, ...awayMatches];
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

// Conta le titolarità nel campionato (mai coppa) su TUTTE le stagioni della
// squadra: è una statistica di "carriera in questa squadra", non della sola
// stagione corrente (confermato dall'utente il 2026-07-31). Filtrare solo
// per team_id, senza passare da matchdays/matches/competitions, mescolava
// invece ANCHE la coppa nel conteggio — bug reale confermato lo stesso
// giorno (una squadra con 6 stagioni di storico: "Soulè 39" era 32
// campionato + 7 coppa nella sola 2025/26).
//
// Si parte da lineups già filtrate per team_id (poche centinaia di righe) e
// si risale a matches/matchdays/competitions, invece del percorso inverso
// (tutte le giornate di campionato di tutte le stagioni, poi tutte le
// partite di tutte le squadre): con 6 stagioni quella lista di partite non
// filtrate per squadra supera la lunghezza URL accettata da Supabase per un
// filtro `.in()` e la query fallisce con "Bad Request".
// Condiviso da getMostFieldedPlayers, getRosterStandout e
// getBestPlayerSeasons: stessa identica catena
// lineups→matches→matchdays→competitions→seasons per isolare le sole
// formazioni di campionato (mai coppa) di una squadra, con la stagione di
// ciascuna.
type LineupSeason = { seasonId: string; seasonLabel: string; startsOn: string };

// ID_CHUNK_SIZE va applicato a ogni `.in('id', ...)`/`.in('lineup_id', ...)`
// la cui lista cresce con "tutte le stagioni di una squadra" (matchIds,
// matchdayIds, lineupIds): con 7 stagioni (dopo l'aggiunta del 2012-13) la
// lista di UUID supera la lunghezza URL accettata da Supabase/PostgREST per
// un filtro `.in()` — fallisce con "fetch failed" lato server, terza volta
// che ricorre lo stesso bug (già visto con 6 stagioni per matchIds, poi di
// nuovo qui aggiungendo la 7ª per matchdayIds: NON basta chunkare un solo
// `.in()` della catena, va rifatto per ognuno che scala con le stagioni).
// 200 id (~36 caratteri l'uno) restano ben sotto il limite di ~16KB
// sull'URL anche sommati agli altri filtri della query. competitionIds e
// seasonIds NON hanno bisogno di chunking: sono già deduplicati a monte e
// restano limitati al numero di competizioni/stagioni esistenti, non al
// numero di partite/giornate/formazioni di una squadra.
const ID_CHUNK_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const getCampionatoLineupSeasons = cache(
  async (supabase: TypedSupabaseClient, teamId: string): Promise<Map<string, LineupSeason>> => {
    const { data: lineups, error: lineupsError } = await supabase
      .from('lineups')
      .select('id, match_id')
      .eq('team_id', teamId);
    if (lineupsError) {
      throw new Error(`Impossibile leggere le formazioni: ${lineupsError.message}`);
    }
    if (lineups.length === 0) {
      return new Map();
    }

    const matchIds = [...new Set(lineups.map((lineup) => lineup.match_id))];
    const matches: { id: string; matchday_id: string }[] = [];
    for (const matchIdsChunk of chunk(matchIds, ID_CHUNK_SIZE)) {
      const { data: matchesPage, error: matchesError } = await supabase
        .from('matches')
        .select('id, matchday_id')
        .in('id', matchIdsChunk);
      if (matchesError) {
        throw new Error(`Impossibile leggere le partite: ${matchesError.message}`);
      }
      matches.push(...matchesPage);
    }

    const matchdayIds = [...new Set(matches.map((match) => match.matchday_id))];
    const matchdays: { id: string; competition_id: string }[] = [];
    for (const matchdayIdsChunk of chunk(matchdayIds, ID_CHUNK_SIZE)) {
      const { data: matchdaysPage, error: matchdaysError } = await supabase
        .from('matchdays')
        .select('id, competition_id')
        .in('id', matchdayIdsChunk);
      if (matchdaysError) {
        throw new Error(`Impossibile leggere le giornate: ${matchdaysError.message}`);
      }
      matchdays.push(...matchdaysPage);
    }

    const competitionIds = [...new Set(matchdays.map((matchday) => matchday.competition_id))];
    const { data: competitions, error: competitionsError } = await supabase
      .from('competitions')
      .select('id, kind_code, season_id')
      .in('id', competitionIds);
    if (competitionsError) {
      throw new Error(`Impossibile leggere i campionati: ${competitionsError.message}`);
    }

    const campionatoCompetitions = competitions.filter((competition) => competition.kind_code === 'campionato');
    const seasonIds = [...new Set(campionatoCompetitions.map((competition) => competition.season_id))];
    const { data: seasons, error: seasonsError } = await supabase
      .from('seasons')
      .select('id, label, starts_on')
      .in('id', seasonIds);
    if (seasonsError) {
      throw new Error(`Impossibile leggere le stagioni: ${seasonsError.message}`);
    }

    const seasonById = new Map(seasons.map((season) => [season.id, season]));
    const seasonIdByCompetition = new Map(
      campionatoCompetitions.map((competition) => [competition.id, competition.season_id]),
    );
    const seasonByMatchday = new Map(
      matchdays.flatMap((matchday) => {
        const seasonId = seasonIdByCompetition.get(matchday.competition_id);
        const season = seasonId ? seasonById.get(seasonId) : undefined;
        if (!seasonId || !season) return [];
        return [[matchday.id, { seasonId, seasonLabel: season.label, startsOn: season.starts_on ?? '' }] as const];
      }),
    );
    const seasonByMatch = new Map(
      matches.flatMap((match) => {
        const season = seasonByMatchday.get(match.matchday_id);
        return season ? [[match.id, season] as const] : [];
      }),
    );

    const result = new Map<string, LineupSeason>();
    for (const lineup of lineups) {
      const season = seasonByMatch.get(lineup.match_id);
      if (season) result.set(lineup.id, season);
    }
    return result;
  },
);

const getCampionatoLineupIds = cache(async (supabase: TypedSupabaseClient, teamId: string): Promise<string[]> => {
  const lineupSeasons = await getCampionatoLineupSeasons(supabase, teamId);
  return [...lineupSeasons.keys()];
});

// Il costo della query non dipende da `limit`: la paginazione qui sotto
// scorre comunque TUTTE le lineup_players campionato della squadra per
// contare le presenze di ognuno, `limit` taglia solo l'array già ordinato
// alla fine. Il chiamante può quindi chiedere fino a 30 (il tetto della
// tendina "quanti mostrare" in KeyPlayersCard) senza query aggiuntive.
export async function getMostFieldedPlayers(
  supabase: TypedSupabaseClient,
  teamId: string,
  limit = 30,
): Promise<FieldedPlayer[]> {
  const lineupIds = await getCampionatoLineupIds(supabase, teamId);
  if (lineupIds.length === 0) {
    return [];
  }

  // lineup_players per 6 stagioni di campionato di una squadra supera le
  // 1000 righe restituite di default da Supabase per risposta: senza
  // paginare esplicitamente con .range(), il conteggio verrebbe troncato in
  // modo silenzioso e arbitrario (bug reale osservato: "Ederson 53" invece
  // del vero totale).
  const appearancesByPlayer = new Map<string, number>();
  const pageSize = 1000;
  for (const lineupIdsChunk of chunk(lineupIds, ID_CHUNK_SIZE)) {
    for (let from = 0; ; from += pageSize) {
      const { data: page, error: pageError } = await supabase
        .from('lineup_players')
        .select('player_id')
        .in('lineup_id', lineupIdsChunk)
        .eq('slot', 'titolare')
        .range(from, from + pageSize - 1);
      if (pageError) {
        throw new Error(`Impossibile leggere i titolari: ${pageError.message}`);
      }
      for (const row of page) {
        appearancesByPlayer.set(row.player_id, (appearancesByPlayer.get(row.player_id) ?? 0) + 1);
      }
      if (page.length < pageSize) break;
    }
  }

  const topPlayerIds = [...appearancesByPlayer.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([playerId]) => playerId);

  if (topPlayerIds.length === 0) {
    return [];
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, canonical_name')
    .in('id', topPlayerIds);

  if (playersError) {
    throw new Error(`Impossibile leggere i giocatori: ${playersError.message}`);
  }

  const nameById = new Map(players.map((player) => [player.id, player.canonical_name]));

  return topPlayerIds.map((playerId) => ({
    playerName: nameById.get(playerId) ?? '—',
    appearances: appearancesByPlayer.get(playerId) ?? 0,
  }));
}

export type LatestMatchdayResult = {
  homeTeamName: string;
  // null per il blocco "solo" di un girone con numero dispari di squadre.
  awayTeamName: string | null;
  homeJerseyUrl: string | null;
  awayJerseyUrl: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
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
    .select('home_team_id, away_team_id, home_goals, away_goals')
    .eq('matchday_id', matchday.id);

  if (matchesError) {
    throw new Error(`Impossibile leggere le partite: ${matchesError.message}`);
  }

  const teamIds = [
    ...new Set(
      matches.flatMap((match) => [match.home_team_id, match.away_team_id]).filter((id): id is string => id !== null),
    ),
  ];
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
      awayTeamName: match.away_team_id ? (nameById.get(match.away_team_id) ?? '—') : null,
      homeJerseyUrl: brandingFor(branding, match.home_team_id).jerseyUrl,
      awayJerseyUrl: match.away_team_id ? brandingFor(branding, match.away_team_id).jerseyUrl : null,
      homeGoals: match.home_goals,
      awayGoals: match.away_goals,
    })),
  };
}

export type GalleryTeam = {
  teamId: string;
  name: string;
  logoUrl: string | null;
  isUserTeam: boolean;
};

// Posizioni del podio, come GalleryTeam[] ordinato [1°, 2°, 3°]. null per le
// stagioni in corso o in assenza di classifica importata: senza standings non
// c'è nulla da mostrare, non si inventa un podio parziale.
export type SeasonGalleryEntry = {
  id: string;
  slug: string;
  label: string;
  inProgress: boolean;
  podium: GalleryTeam[] | null;
  // Vincitore Coppa: posizione 1 della fase finale. Le altre fasi (girone,
  // spareggio) sono qualificazione, non il titolo — stesso filtro di
  // getAllTimeTitleCounts, fonte unica per "chi ha vinto la coppa".
  cupWinner: GalleryTeam | null;
  // false per le stagioni con solo un podio manuale (nessuna giornata reale,
  // es. 2004-05→2012-13): la card mostra comunque il podio ma il click verso
  // la classifica va disabilitato, non porterebbe a nulla di navigabile.
  hasSchedule: boolean;
};

export async function getSeasonGallery(
  supabase: TypedSupabaseClient,
  userTeamId?: string | null,
): Promise<SeasonGalleryEntry[]> {
  const seasons: SeasonOption[] = await getSeasons(supabase);
  if (seasons.length === 0) {
    return [];
  }

  // Competizioni che assegnano un trofeo: campionato (per il podio) e coppa
  // fase finale (per il vincitore coppa). Stesso insieme di TITLE_KIND_CODES.
  const { data: competitions, error: competitionsError } = await supabase
    .from('competitions')
    .select('id, season_id, kind_code')
    .in(
      'season_id',
      seasons.map((season) => season.id),
    )
    .in('kind_code', [...TITLE_KIND_CODES]);

  if (competitionsError) {
    throw new Error(`Impossibile leggere le competizioni: ${competitionsError.message}`);
  }

  const campionatoBySeason = new Map<string, string>();
  const coppaBySeason = new Map<string, string>();
  for (const competition of competitions) {
    if (competition.kind_code === 'campionato') {
      campionatoBySeason.set(competition.season_id, competition.id);
    } else if (competition.kind_code === 'coppa_fase_finale') {
      coppaBySeason.set(competition.season_id, competition.id);
    }
  }

  const today = new Date();

  // Podio campionato: posizioni 1-3 per competizione, in una sola query
  // invece di tre (la classifica è piccola: 10-12 righe a stagione).
  const standingsByCompetition = new Map<string, Map<number, string>>();
  const teamIdsNeeded = new Set<string>();

  const campionatoCompetitionIds = [...campionatoBySeason.values()];
  if (campionatoCompetitionIds.length > 0) {
    const { data: standingsRows, error: standingsError } = await supabase
      .from('standings')
      .select('position, team_id, competition_id')
      .in('competition_id', campionatoCompetitionIds)
      .in('position', [1, 2, 3]);

    if (standingsError) {
      throw new Error(`Impossibile leggere la classifica: ${standingsError.message}`);
    }

    for (const row of standingsRows) {
      if (row.position === null) continue;
      let byPosition = standingsByCompetition.get(row.competition_id);
      if (!byPosition) {
        byPosition = new Map();
        standingsByCompetition.set(row.competition_id, byPosition);
      }
      byPosition.set(row.position, row.team_id);
      teamIdsNeeded.add(row.team_id);
    }
  }

  // Vincitore Coppa: dedotto dalla finale (vedi getCupFinalWinners), con
  // fallback a standings solo per le competizioni senza giornate reali
  // (podio manuale da nota storica).
  const coppaCompetitionIds = [...coppaBySeason.values()];
  const cupWinnerByCompetition = await getCupFinalWinners(supabase, coppaCompetitionIds);
  for (const teamId of cupWinnerByCompetition.values()) {
    teamIdsNeeded.add(teamId);
  }

  // Nomi canonici delle squadre coinvolte (fallback quando team_seasons non
  // ha il display_name stagionale).
  const teamNameById = new Map<string, string>();
  if (teamIdsNeeded.size > 0) {
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, canonical_name')
      .in('id', [...teamIdsNeeded]);

    if (teamsError) {
      throw new Error(`Impossibile leggere le squadre: ${teamsError.message}`);
    }

    for (const team of teams) {
      teamNameById.set(team.id, team.canonical_name);
    }
  }

  // Raggruppa gli id squadra per stagione, per sfruttare getTeamBranding
  // (logo/maglia/nome) con una chiamata per stagione invece di una per team.
  const seasonTeamIds = new Map<string, Set<string>>();
  for (const [seasonId, campionatoCompId] of campionatoBySeason) {
    const byPosition = standingsByCompetition.get(campionatoCompId);
    if (byPosition && byPosition.size > 0) {
      const set = seasonTeamIds.get(seasonId) ?? new Set<string>();
      seasonTeamIds.set(seasonId, set);
      for (const teamId of byPosition.values()) {
        set.add(teamId);
      }
    }
  }
  for (const [seasonId, coppaCompId] of coppaBySeason) {
    const teamId = cupWinnerByCompetition.get(coppaCompId);
    if (teamId) {
      const set = seasonTeamIds.get(seasonId) ?? new Set<string>();
      seasonTeamIds.set(seasonId, set);
      set.add(teamId);
    }
  }

  const seasonTeamEntries = [...seasonTeamIds.entries()];
  const brandingResults = await Promise.all(
    seasonTeamEntries.map(([seasonId, teamIds]) => getTeamBranding(supabase, seasonId, [...teamIds])),
  );
  const brandingBySeason = new Map(seasonTeamEntries.map((entry, i) => [entry[0], brandingResults[i]]));

  function resolveTeam(teamId: string, seasonId: string): GalleryTeam {
    const branding = brandingBySeason.get(seasonId);
    const info = branding ? brandingFor(branding, teamId) : { displayName: null, logoUrl: null };
    return {
      teamId,
      name: info.displayName ?? teamNameById.get(teamId) ?? '—',
      logoUrl: info.logoUrl,
      isUserTeam: userTeamId === teamId,
    };
  }

  return seasons.map((season) => {
    const inProgress = season.endsOn === null || new Date(season.endsOn) > today;

    if (inProgress) {
      return {
        id: season.id,
        slug: season.slug,
        label: season.label,
        inProgress,
        podium: null,
        cupWinner: null,
        hasSchedule: season.hasSchedule,
      };
    }

    const campionatoCompId = campionatoBySeason.get(season.id);
    const byPosition = campionatoCompId ? standingsByCompetition.get(campionatoCompId) : undefined;
    const podium: GalleryTeam[] = [];
    if (byPosition) {
      for (let pos = 1; pos <= 3; pos++) {
        const teamId = byPosition.get(pos);
        if (teamId) podium.push(resolveTeam(teamId, season.id));
      }
    }

    const coppaCompId = coppaBySeason.get(season.id);
    const cupTeamId = coppaCompId ? cupWinnerByCompetition.get(coppaCompId) : undefined;
    const cupWinner = cupTeamId ? resolveTeam(cupTeamId, season.id) : null;

    return {
      id: season.id,
      slug: season.slug,
      label: season.label,
      inProgress,
      podium: podium.length > 0 ? podium : null,
      cupWinner,
      hasSchedule: season.hasSchedule,
    };
  });
}

export type StandingHistoryPoint = { seasonSlug: string; seasonLabel: string; position: number };

// Andamento storico del piazzamento in campionato (mai coppa), una tessera
// per stagione: stesso pattern anti-URL-troppo-lunga di getMostFieldedPlayers,
// si parte da standings già filtrate per team_id (poche righe, una per
// competizione a cui la squadra ha partecipato) e non da "tutte le
// competizioni campionato di tutte le stagioni".
export async function getStandingHistory(supabase: TypedSupabaseClient, teamId: string): Promise<StandingHistoryPoint[]> {
  const { data: standingsRows, error: standingsError } = await supabase
    .from('standings')
    .select('position, competition_id')
    .eq('team_id', teamId);
  if (standingsError) {
    throw new Error(`Impossibile leggere le classifiche: ${standingsError.message}`);
  }
  if (standingsRows.length === 0) {
    return [];
  }

  const competitionIds = [...new Set(standingsRows.map((row) => row.competition_id))];
  const { data: competitions, error: competitionsError } = await supabase
    .from('competitions')
    .select('id, season_id, kind_code')
    .in('id', competitionIds);
  if (competitionsError) {
    throw new Error(`Impossibile leggere le competizioni: ${competitionsError.message}`);
  }

  const seasonIdByCompetition = new Map(
    competitions.filter((competition) => competition.kind_code === 'campionato').map((competition) => [competition.id, competition.season_id]),
  );
  if (seasonIdByCompetition.size === 0) {
    return [];
  }

  const seasonIds = [...new Set(seasonIdByCompetition.values())];
  const { data: seasons, error: seasonsError } = await supabase
    .from('seasons')
    .select('id, slug, label, starts_on')
    .in('id', seasonIds);
  if (seasonsError) {
    throw new Error(`Impossibile leggere le stagioni: ${seasonsError.message}`);
  }

  const seasonById = new Map(seasons.map((season) => [season.id, season]));

  const points = standingsRows.flatMap((row) => {
    const seasonId = seasonIdByCompetition.get(row.competition_id);
    const season = seasonId ? seasonById.get(seasonId) : undefined;
    if (!season || row.position === null) {
      return [];
    }
    return [{ seasonSlug: season.slug, seasonLabel: season.label, position: row.position, startsOn: season.starts_on ?? '' }];
  });

  points.sort((a, b) => a.startsOn.localeCompare(b.startsOn));

  return points.map(({ seasonSlug, seasonLabel, position }) => ({ seasonSlug, seasonLabel, position }));
}

// team_seasons: una riga per (team_id, season_id) indipendentemente dalla
// competizione (Campionato o solo Coppa) — a differenza di getStandingHistory
// (solo Campionato), è la fonte corretta per "in quante stagioni ha
// partecipato", altrimenti una stagione senza classifica Campionato
// risulterebbe non conteggiata pur avendo la squadra effettivamente giocato.
export async function getSeasonsParticipatedCount(supabase: TypedSupabaseClient, teamId: string): Promise<number> {
  const { count, error } = await supabase
    .from('team_seasons')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);
  if (error) {
    throw new Error(`Impossibile leggere le stagioni disputate: ${error.message}`);
  }
  return count ?? 0;
}

export type RosterLoyaltyEntry = { playerName: string; seasonsCount: number };

// "Fedeltà": in quante stagioni (anche NON consecutive) un giocatore è stato
// in rosa per QUESTA squadra — non una striscia, un totale.
//
// La 2022-23 non ha mai avuto Rose_fantatopa.xlsx (season-configs.ts:
// rosterFolder undefined, nessuna squadra ha righe `rosters` quell'anno):
// non contribuisce al conteggio di nessun giocatore, ma è un trattamento
// uguale per tutti (nessuno "vede" quella stagione), quindi non serve
// scoprire quali stagioni abbiano dati come andrebbe fatto per una striscia
// consecutiva — un semplice conteggio per player_id basta.
export async function getRosterLoyalty(supabase: TypedSupabaseClient, teamId: string, minSeasons = 2, limit = 30): Promise<RosterLoyaltyEntry[]> {
  const { data: rosterRows, error: rosterError } = await supabase
    .from('rosters')
    .select('player_id, season_id')
    .eq('team_id', teamId);
  if (rosterError) {
    throw new Error(`Impossibile leggere le rose: ${rosterError.message}`);
  }

  const seasonIdsByPlayer = new Map<string, Set<string>>();
  for (const row of rosterRows) {
    const set = seasonIdsByPlayer.get(row.player_id) ?? new Set<string>();
    set.add(row.season_id);
    seasonIdsByPlayer.set(row.player_id, set);
  }

  const counts = [...seasonIdsByPlayer.entries()]
    .map(([playerId, seasonIds]) => ({ playerId, seasonsCount: seasonIds.size }))
    .filter((entry) => entry.seasonsCount >= minSeasons);
  if (counts.length === 0) {
    return [];
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, canonical_name')
    .in(
      'id',
      counts.map((entry) => entry.playerId),
    );
  if (playersError) {
    throw new Error(`Impossibile leggere i giocatori: ${playersError.message}`);
  }

  const nameById = new Map(players.map((player) => [player.id, player.canonical_name]));

  return counts
    .map((entry) => ({
      playerName: nameById.get(entry.playerId) ?? '—',
      seasonsCount: entry.seasonsCount,
    }))
    .sort((a, b) => b.seasonsCount - a.seasonsCount || a.playerName.localeCompare(b.playerName))
    .slice(0, limit);
}

export type RosterStandout = {
  playerName: string;
  averageFantavoto: number;
  appearances: number;
  fromSeasonLabel: string;
  toSeasonLabel: string;
};

// "Fuoriclasse della rosa": media fantavoto più alta fra i titolari/subentrati
// che contano per il totale squadra. `counts_for_total`, non `slot`: un
// panchinaro subentrato può contare (counts_for_total=true, slot='panchina'
// comunque), un titolare non sostituito che non gioca la partita successiva
// non c'entra qui — è la stessa distinzione già documentata nella migrazione
// che ha introdotto la colonna. Soglia minima di presenze per non far
// vincere un exploit da una sola giornata — applicata sia qui (carriera)
// sia in getBestPlayerSeasons (singola stagione).
const MIN_APPEARANCES_FOR_STANDOUT = 10;

type FantavotoRow = { playerId: string; fantavoto: number; season: LineupSeason };

// Condivisa da getRosterStandout e getBestPlayerSeasons: stessa paginazione
// di lineup_players filtrata per counts_for_total, ciascuna riga arricchita
// con la stagione della sua formazione (serve a entrambe, con aggregazioni
// diverse: per giocatore su tutta la carriera vs. per giocatore+stagione).
const getCampionatoFantavotoRows = cache(
  async (supabase: TypedSupabaseClient, teamId: string): Promise<FantavotoRow[]> => {
    const lineupSeasons = await getCampionatoLineupSeasons(supabase, teamId);
    if (lineupSeasons.size === 0) {
      return [];
    }
    const lineupIds = [...lineupSeasons.keys()];

    // Stessa cautela di paginazione di getMostFieldedPlayers: 6 stagioni di
    // campionato superano le 1000 righe di default per risposta.
    const rows: FantavotoRow[] = [];
    const pageSize = 1000;
    for (const lineupIdsChunk of chunk(lineupIds, ID_CHUNK_SIZE)) {
      for (let from = 0; ; from += pageSize) {
        const { data: page, error: pageError } = await supabase
          .from('lineup_players')
          .select('player_id, fantavoto, lineup_id')
          .in('lineup_id', lineupIdsChunk)
          .eq('counts_for_total', true)
          .range(from, from + pageSize - 1);
        if (pageError) {
          throw new Error(`Impossibile leggere i fantavoti: ${pageError.message}`);
        }
        for (const row of page) {
          if (row.fantavoto === null) continue;
          const season = lineupSeasons.get(row.lineup_id);
          if (!season) continue;
          rows.push({ playerId: row.player_id, fantavoto: row.fantavoto, season });
        }
        if (page.length < pageSize) break;
      }
    }
    return rows;
  },
);

export async function getRosterStandout(
  supabase: TypedSupabaseClient,
  teamId: string,
  limit = 30,
): Promise<RosterStandout[]> {
  const rows = await getCampionatoFantavotoRows(supabase, teamId);
  if (rows.length === 0) {
    return [];
  }

  const totalsByPlayer = new Map<
    string,
    { sum: number; count: number; from: LineupSeason; to: LineupSeason }
  >();
  for (const row of rows) {
    const entry = totalsByPlayer.get(row.playerId) ?? { sum: 0, count: 0, from: row.season, to: row.season };
    entry.sum += row.fantavoto;
    entry.count += 1;
    if (row.season.startsOn.localeCompare(entry.from.startsOn) < 0) entry.from = row.season;
    if (row.season.startsOn.localeCompare(entry.to.startsOn) > 0) entry.to = row.season;
    totalsByPlayer.set(row.playerId, entry);
  }

  const best = [...totalsByPlayer.entries()]
    .map(([playerId, entry]) => ({
      playerId,
      average: entry.sum / entry.count,
      appearances: entry.count,
      fromSeasonLabel: entry.from.seasonLabel,
      toSeasonLabel: entry.to.seasonLabel,
    }))
    .filter((entry) => entry.appearances >= MIN_APPEARANCES_FOR_STANDOUT)
    .sort((a, b) => b.average - a.average || a.playerId.localeCompare(b.playerId))
    .slice(0, limit);
  if (best.length === 0) {
    return [];
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, canonical_name')
    .in(
      'id',
      best.map((entry) => entry.playerId),
    );
  if (playersError) {
    throw new Error(`Impossibile leggere i giocatori: ${playersError.message}`);
  }
  const nameById = new Map(players.map((player) => [player.id, player.canonical_name]));

  return best.map((entry) => ({
    playerName: nameById.get(entry.playerId) ?? '—',
    averageFantavoto: Math.round(entry.average * 100) / 100,
    appearances: entry.appearances,
    fromSeasonLabel: entry.fromSeasonLabel,
    toSeasonLabel: entry.toSeasonLabel,
  }));
}

export type PlayerSeasonStandout = {
  playerName: string;
  averageFantavoto: number;
  appearances: number;
  seasonLabel: string;
};

// "Miglior stagione individuale": come getRosterStandout ma la media è
// calcolata per singola stagione (non sull'intera carriera in squadra), così
// lo stesso giocatore può comparire più volte per annate diverse. Stessa
// soglia minima di presenze di getRosterStandout, riferita però alle sole
// presenze di quella stagione.
export async function getBestPlayerSeasons(
  supabase: TypedSupabaseClient,
  teamId: string,
  limit = 30,
): Promise<PlayerSeasonStandout[]> {
  const rows = await getCampionatoFantavotoRows(supabase, teamId);
  if (rows.length === 0) {
    return [];
  }

  const totalsByPlayerSeason = new Map<string, { playerId: string; seasonLabel: string; sum: number; count: number }>();
  for (const row of rows) {
    const key = `${row.playerId}|${row.season.seasonId}`;
    const entry = totalsByPlayerSeason.get(key) ?? {
      playerId: row.playerId,
      seasonLabel: row.season.seasonLabel,
      sum: 0,
      count: 0,
    };
    entry.sum += row.fantavoto;
    entry.count += 1;
    totalsByPlayerSeason.set(key, entry);
  }

  const best = [...totalsByPlayerSeason.values()]
    .map((entry) => ({
      playerId: entry.playerId,
      seasonLabel: entry.seasonLabel,
      average: entry.sum / entry.count,
      appearances: entry.count,
    }))
    .filter((entry) => entry.appearances >= MIN_APPEARANCES_FOR_STANDOUT)
    .sort((a, b) => b.average - a.average || a.playerId.localeCompare(b.playerId))
    .slice(0, limit);
  if (best.length === 0) {
    return [];
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, canonical_name')
    .in(
      'id',
      best.map((entry) => entry.playerId),
    );
  if (playersError) {
    throw new Error(`Impossibile leggere i giocatori: ${playersError.message}`);
  }
  const nameById = new Map(players.map((player) => [player.id, player.canonical_name]));

  return best.map((entry) => ({
    playerName: nameById.get(entry.playerId) ?? '—',
    averageFantavoto: Math.round(entry.average * 100) / 100,
    appearances: entry.appearances,
    seasonLabel: entry.seasonLabel,
  }));
}

export type UnbeatenStreak = {
  length: number;
  seasonLabel: string;
  fromMatchdayNumber: number;
  toMatchdayNumber: number;
  // Record indipendente dalla striscia utile sopra: può cadere in una
  // stagione diversa, per questo porta la propria seasonLabel invece di
  // riusare quella della striscia utile.
  longestWinningStreak: { length: number; seasonLabel: string } | null;
};

type ChronoMatch = { startsOn: string; matchdayNumber: number; seasonId: string; seasonLabel: string; points: number };

type StreakRange = { length: number; seasonLabel: string; fromMatchdayNumber: number; toMatchdayNumber: number };

// Striscia più lunga di partite consecutive che soddisfano `isStreak`, mai a
// cavallo di un cambio stagione. Condivisa da getLongestUnbeatenStreak per
// calcolare sia la striscia utile (vittoria o pareggio) sia il record di
// sole vittorie sugli stessi dati già caricati, senza una seconda query.
function longestStreak(chronoMatches: ChronoMatch[], isStreak: (match: ChronoMatch) => boolean): StreakRange | null {
  let bestLength = 0;
  let bestStart = -1;
  let bestEnd = -1;
  let currentLength = 0;
  let currentStart = 0;
  for (let i = 0; i < chronoMatches.length; i++) {
    const current = chronoMatches[i];
    if (!current) continue;
    // Una striscia non attraversa il cambio di stagione: azzerare qui,
    // prima di valutare la partita corrente, impedisce di incatenare il
    // finale di una stagione con l'inizio della successiva.
    const previous = i > 0 ? chronoMatches[i - 1] : null;
    if (previous && previous.seasonId !== current.seasonId) {
      currentLength = 0;
    }
    if (isStreak(current)) {
      if (currentLength === 0) {
        currentStart = i;
      }
      currentLength += 1;
      if (currentLength > bestLength) {
        bestLength = currentLength;
        bestStart = currentStart;
        bestEnd = i;
      }
    } else {
      currentLength = 0;
    }
  }
  if (bestStart === -1 || bestEnd === -1) {
    return null;
  }
  const from = chronoMatches[bestStart];
  const to = chronoMatches[bestEnd];
  if (!from || !to) {
    return null;
  }
  return {
    length: bestLength,
    seasonLabel: from.seasonLabel,
    fromMatchdayNumber: from.matchdayNumber,
    toMatchdayNumber: to.matchdayNumber,
  };
}

// "Serie utile": striscia più lunga di partite consecutive senza sconfitta
// (vittoria o pareggio), entro una singola stagione — mai a cavallo di due
// stagioni (richiesto esplicitamente: un fine-stagione imbattuto seguito da
// un inizio-stagione altrettanto imbattuto non è "la stessa striscia"). Solo
// campionato, mai coppa: `matches` non ha una data reale per partita, solo
// matchday_id → number relativo alla competizione, quindi non c'è modo
// affidabile di intrecciare cronologicamente giornate di gironi/fase finale
// di coppa con quelle di campionato nella stessa stagione — stesso perimetro
// di Andamento storico/Giocatori chiave. Riusa home_result_points/
// away_result_points (3/1/0, già derivati in fase di import) invece di
// ricalcolare vittoria/pareggio/sconfitta confrontando home_score/away_score
// a mano.
export async function getLongestUnbeatenStreak(supabase: TypedSupabaseClient, teamId: string): Promise<UnbeatenStreak | null> {
  // ponytail: matchdays per competition_id (≤16 ID) per evitare URL troppo lunga.
  const [{ homeMatches, awayMatches }, competitionsResult] = await Promise.all([
    getTeamMatches(supabase, teamId),
    supabase.from('competitions').select('id, season_id').eq('kind_code', 'campionato'),
  ]);
  if (competitionsResult.error) {
    throw new Error(`Impossibile leggere le competizioni: ${competitionsResult.error.message}`);
  }

  const matches = [
    ...homeMatches.map((match) => ({ matchdayId: match.matchday_id, points: match.home_result_points })),
    ...awayMatches.map((match) => ({ matchdayId: match.matchday_id, points: match.away_result_points })),
  ];
  if (matches.length === 0) {
    return null;
  }

  const campionatoCompetitions = competitionsResult.data;
  const campionatoCompetitionIds = campionatoCompetitions.map((c) => c.id);
  const seasonIds = [...new Set(campionatoCompetitions.map((c) => c.season_id))];

  const [matchdaysResult, seasonsResult] = await Promise.all([
    supabase.from('matchdays').select('id, number, competition_id').in('competition_id', campionatoCompetitionIds),
    supabase.from('seasons').select('id, label, starts_on').in('id', seasonIds),
  ]);
  if (matchdaysResult.error) {
    throw new Error(`Impossibile leggere le giornate: ${matchdaysResult.error.message}`);
  }
  if (seasonsResult.error) {
    throw new Error(`Impossibile leggere le stagioni: ${seasonsResult.error.message}`);
  }

  const matchdays = matchdaysResult.data;
  const seasons = seasonsResult.data;

  const seasonIdByCampionatoCompetition = new Map(
    campionatoCompetitions.map((competition) => [competition.id, competition.season_id]),
  );

  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const matchdayById = new Map(matchdays.map((matchday) => [matchday.id, matchday]));

  const chronoMatches: ChronoMatch[] = [];
  for (const match of matches) {
    if (match.points === null) continue;
    const matchday = matchdayById.get(match.matchdayId);
    if (!matchday) continue;
    const seasonId = seasonIdByCampionatoCompetition.get(matchday.competition_id);
    if (!seasonId) continue;
    const season = seasonById.get(seasonId);
    if (!season) continue;
    chronoMatches.push({
      startsOn: season.starts_on ?? '',
      matchdayNumber: matchday.number,
      seasonId,
      seasonLabel: season.label,
      points: match.points,
    });
  }
  chronoMatches.sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.matchdayNumber - b.matchdayNumber);

  const unbeaten = longestStreak(chronoMatches, (match) => match.points > 0);
  if (!unbeaten) {
    return null;
  }
  const winning = longestStreak(chronoMatches, (match) => match.points === 3);

  return {
    length: unbeaten.length,
    seasonLabel: unbeaten.seasonLabel,
    fromMatchdayNumber: unbeaten.fromMatchdayNumber,
    toMatchdayNumber: unbeaten.toMatchdayNumber,
    longestWinningStreak: winning ? { length: winning.length, seasonLabel: winning.seasonLabel } : null,
  };
}
