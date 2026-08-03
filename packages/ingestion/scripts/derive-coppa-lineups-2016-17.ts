// packages/ingestion/scripts/derive-coppa-lineups-2016-17.ts
//
// Deriva le formazioni mancanti di Coppa per la stagione 2016-17 prendendo
// come sorgente una giornata di Campionato con lo stesso punteggio reale
// (home_score/away_score) per le stesse squadre.
//
// Scope intenzionale:
// - Coppa Seconda Fase e Coppa Fase Finale: hanno match reali importati ma
//   lineups assenti -> backfill automatico.
// - Coppa Girone A/B: in questa stagione non esistono match/giornate nel DB
//   (solo classifica snapshot), quindi non c'e un contenitore dove inserire
//   lineups senza inventare pairing/score mancanti.
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/derive-coppa-lineups-2016-17.ts
import 'dotenv/config';
import { createIngestionClient } from '../lib/supabase-client.js';

type SupabaseClientType = ReturnType<typeof createIngestionClient>;

type CampLineupInfo = {
  formation: string | null;
  players: Array<{
    player_id: string;
    slot: string;
    position_order: number | null;
    voto: number | null;
    fantavoto: number | null;
    counts_for_total: boolean;
  }>;
};

type CampLineupSource = {
  lineup: CampLineupInfo;
  matchdayId: string;
};

async function fetchAllPaged<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

function scoreKey(score: number): string {
  return score.toFixed(2);
}

function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>();
  for (const x of a) {
    if (b.has(x)) out.add(x);
  }
  return out;
}

function sumFantavoto(players: CampLineupInfo['players']): number {
  return players.filter((p) => p.counts_for_total).reduce((acc, p) => acc + (p.fantavoto ?? 0), 0);
}

async function insertDerivedLineup(
  supabase: SupabaseClientType,
  matchId: string,
  teamId: string,
  camp: CampLineupInfo,
  realScore: number,
) {
  const { data: existing, error: existingErr } = await supabase
    .from('lineups')
    .select('id')
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) return false;

  const sum = sumFantavoto(camp.players);
  const rawDefenseModifier = realScore - sum;
  const defenseModifier = Math.round(rawDefenseModifier);
  const rounding = rawDefenseModifier - defenseModifier;
  if (Math.abs(rounding) > 0.01) {
    console.log(
      `  [nota] match=${matchId} team=${teamId}: plug difesa non intero (${rawDefenseModifier.toFixed(2)} -> ${defenseModifier})`,
    );
  }

  const { data: newLineup, error: insErr } = await supabase
    .from('lineups')
    .insert({
      match_id: matchId,
      team_id: teamId,
      formation: camp.formation,
      defense_modifier: defenseModifier,
      field_advantage: 0,
      submitted_via: null,
      submitted_at: null,
    })
    .select('id')
    .single();
  if (insErr || !newLineup) throw new Error(`Insert lineup fallito: ${insErr?.message}`);

  if (camp.players.length > 0) {
    const { error: playersErr } = await supabase.from('lineup_players').insert(
      camp.players.map((p) => ({
        lineup_id: newLineup.id,
        player_id: p.player_id,
        slot: p.slot,
        position_order: p.position_order,
        voto: p.voto,
        fantavoto: p.fantavoto,
        counts_for_total: p.counts_for_total,
      })),
    );
    if (playersErr) throw new Error(`Insert lineup_players fallito: ${playersErr.message}`);
  }

  return true;
}

async function main() {
  const supabase = createIngestionClient();

  const { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .select('id')
    .eq('slug', '2016-17')
    .single();
  if (seasonErr || !season) throw new Error(`Stagione 2016-17 non trovata: ${seasonErr?.message}`);

  const { data: competitions, error: compErr } = await supabase
    .from('competitions')
    .select('id, slug')
    .eq('season_id', season.id)
    .in('slug', ['campionato', 'coppa-seconda-fase', 'coppa-fase-finale']);
  if (compErr) throw compErr;

  const compBySlug = new Map((competitions ?? []).map((c) => [c.slug, c.id]));
  const campionatoId = compBySlug.get('campionato');
  const coppaCompIds = [compBySlug.get('coppa-seconda-fase'), compBySlug.get('coppa-fase-finale')].filter(
    (v): v is string => Boolean(v),
  );
  if (!campionatoId) throw new Error('Competizione campionato non trovata');
  if (coppaCompIds.length === 0) throw new Error('Nessuna competizione coppa target trovata');

  const { data: campMatchdays, error: campMdErr } = await supabase
    .from('matchdays')
    .select('id, number')
    .eq('competition_id', campionatoId);
  if (campMdErr) throw campMdErr;
  const campMatchdayNumberById = new Map((campMatchdays ?? []).map((m) => [m.id, m.number]));

  const campMatches = await fetchAllPaged<{
    id: string;
    matchday_id: string;
    home_team_id: string;
    away_team_id: string | null;
    home_score: number | null;
    away_score: number | null;
  }>((from, to) =>
    supabase
      .from('matches')
      .select('id, matchday_id, home_team_id, away_team_id, home_score, away_score')
      .in('matchday_id', (campMatchdays ?? []).map((m) => m.id))
      .range(from, to),
  );

  const campLineups = await fetchAllPaged<{
    id: string;
    match_id: string;
    team_id: string;
    formation: string | null;
  }>((from, to) =>
    supabase
      .from('lineups')
      .select('id, match_id, team_id, formation')
      .in(
        'match_id',
        campMatches.map((m) => m.id),
      )
      .range(from, to),
  );

  const campPlayers = await fetchAllPaged<{
    lineup_id: string;
    player_id: string;
    slot: string;
    position_order: number | null;
    voto: number | null;
    fantavoto: number | null;
    counts_for_total: boolean;
  }>((from, to) =>
    supabase
      .from('lineup_players')
      .select('lineup_id, player_id, slot, position_order, voto, fantavoto, counts_for_total')
      .in(
        'lineup_id',
        campLineups.map((l) => l.id),
      )
      .range(from, to),
  );

  const playersByLineup = new Map<string, CampLineupInfo['players']>();
  for (const p of campPlayers) {
    const arr = playersByLineup.get(p.lineup_id) ?? [];
    arr.push(p);
    playersByLineup.set(p.lineup_id, arr);
  }

  const lineupByMatchTeam = new Map<string, CampLineupInfo>();
  for (const l of campLineups) {
    lineupByMatchTeam.set(`${l.match_id}:${l.team_id}`, {
      formation: l.formation,
      players: playersByLineup.get(l.id) ?? [],
    });
  }

  const lineupByMatchdayTeam = new Map<string, CampLineupSource>();
  const scoreToMatchdaysByTeam = new Map<string, Set<number>>();
  const teamMatchdays = new Map<string, Set<number>>();
  const scoreByMatchdayTeam = new Map<string, number>();
  for (const m of campMatches) {
    const matchdayNumber = campMatchdayNumberById.get(m.matchday_id);
    if (!matchdayNumber) continue;

    if (m.home_score !== null) {
      const homeLineup = lineupByMatchTeam.get(`${m.id}:${m.home_team_id}`);
      if (homeLineup) {
        lineupByMatchdayTeam.set(`${matchdayNumber}:${m.home_team_id}`, {
          lineup: homeLineup,
          matchdayId: m.matchday_id,
        });
      }
      const key = `${m.home_team_id}:${scoreKey(m.home_score)}`;
      const set = scoreToMatchdaysByTeam.get(key) ?? new Set<number>();
      set.add(matchdayNumber);
      scoreToMatchdaysByTeam.set(key, set);
      const daySet = teamMatchdays.get(m.home_team_id) ?? new Set<number>();
      daySet.add(matchdayNumber);
      teamMatchdays.set(m.home_team_id, daySet);
      scoreByMatchdayTeam.set(`${matchdayNumber}:${m.home_team_id}`, m.home_score);
    }

    if (m.away_team_id && m.away_score !== null) {
      const awayLineup = lineupByMatchTeam.get(`${m.id}:${m.away_team_id}`);
      if (awayLineup) {
        lineupByMatchdayTeam.set(`${matchdayNumber}:${m.away_team_id}`, {
          lineup: awayLineup,
          matchdayId: m.matchday_id,
        });
      }
      const key = `${m.away_team_id}:${scoreKey(m.away_score)}`;
      const set = scoreToMatchdaysByTeam.get(key) ?? new Set<number>();
      set.add(matchdayNumber);
      scoreToMatchdaysByTeam.set(key, set);
      const daySet = teamMatchdays.get(m.away_team_id) ?? new Set<number>();
      daySet.add(matchdayNumber);
      teamMatchdays.set(m.away_team_id, daySet);
      scoreByMatchdayTeam.set(`${matchdayNumber}:${m.away_team_id}`, m.away_score);
    }
  }

  const { data: coppaMatchdays, error: coppaMdErr } = await supabase
    .from('matchdays')
    .select('id, number, competition_id')
    .in('competition_id', coppaCompIds);
  if (coppaMdErr) throw coppaMdErr;

  const coppaMatches = await fetchAllPaged<{
    id: string;
    matchday_id: string;
    home_team_id: string;
    away_team_id: string | null;
    home_score: number | null;
    away_score: number | null;
  }>((from, to) =>
    supabase
      .from('matches')
      .select('id, matchday_id, home_team_id, away_team_id, home_score, away_score')
      .in('matchday_id', (coppaMatchdays ?? []).map((m) => m.id))
      .range(from, to),
  );

  let insertedLineups = 0;
  for (const coppa of coppaMatches) {
    if (coppa.home_score === null) {
      console.log(`skip match ${coppa.id}: home_score nullo`);
      continue;
    }

    const homeCandidates = scoreToMatchdaysByTeam.get(`${coppa.home_team_id}:${scoreKey(coppa.home_score)}`) ?? new Set();
    let sourceCandidates = new Set(homeCandidates);

    if (coppa.away_team_id && coppa.away_score !== null) {
      const awayCandidates =
        scoreToMatchdaysByTeam.get(`${coppa.away_team_id}:${scoreKey(coppa.away_score)}`) ?? new Set<number>();
      sourceCandidates = intersection(sourceCandidates, awayCandidates);
    }

    const candidates = [...sourceCandidates.values()].sort((a, b) => a - b);
    let sourceMatchdayNumber: number | null = candidates.length === 1 ? candidates[0]! : null;

    if (sourceMatchdayNumber === null) {
      const homeDays = teamMatchdays.get(coppa.home_team_id) ?? new Set<number>();
      let commonDays = new Set<number>(homeDays);
      if (coppa.away_team_id) {
        const awayDays = teamMatchdays.get(coppa.away_team_id) ?? new Set<number>();
        commonDays = intersection(commonDays, awayDays);
      }

      let bestDay: number | null = null;
      let bestDiff = Number.POSITIVE_INFINITY;
      for (const day of commonDays) {
        const homeCampScore = scoreByMatchdayTeam.get(`${day}:${coppa.home_team_id}`);
        if (homeCampScore === undefined) continue;
        let diff = Math.abs(homeCampScore - coppa.home_score);
        if (coppa.away_team_id && coppa.away_score !== null) {
          const awayCampScore = scoreByMatchdayTeam.get(`${day}:${coppa.away_team_id}`);
          if (awayCampScore === undefined) continue;
          diff += Math.abs(awayCampScore - coppa.away_score);
        }
        if (diff < bestDiff) {
          bestDiff = diff;
          bestDay = day;
        }
      }

      if (bestDay !== null) {
        sourceMatchdayNumber = bestDay;
        console.log(
          `match ${coppa.id}: fallback matchday ${bestDay} (diff totale punteggi ${bestDiff.toFixed(2)})`,
        );
      }
    }

    if (sourceMatchdayNumber === null) {
      console.log(
        `skip match ${coppa.id}: mapping campionato ambiguo/assente (candidati esatti: ${candidates.join(', ') || 'nessuno'})`,
      );
      continue;
    }
    const homeSource = lineupByMatchdayTeam.get(`${sourceMatchdayNumber}:${coppa.home_team_id}`);
    if (!homeSource) {
      console.log(`skip home lineup match ${coppa.id}: lineup sorgente non trovata`);
      continue;
    }

    const insertedHome = await insertDerivedLineup(
      supabase,
      coppa.id,
      coppa.home_team_id,
      homeSource.lineup,
      coppa.home_score,
    );
    if (insertedHome) insertedLineups += 1;

    if (coppa.away_team_id && coppa.away_score !== null) {
      const awaySource = lineupByMatchdayTeam.get(`${sourceMatchdayNumber}:${coppa.away_team_id}`);
      if (!awaySource) {
        console.log(`skip away lineup match ${coppa.id}: lineup sorgente non trovata`);
      } else {
        const insertedAway = await insertDerivedLineup(
          supabase,
          coppa.id,
          coppa.away_team_id,
          awaySource.lineup,
          coppa.away_score,
        );
        if (insertedAway) insertedLineups += 1;
      }
    }

    const matchdayId = coppa.matchday_id;
    const sourceMatchdayId = homeSource.matchdayId;
    const { error: sourceErr } = await supabase
      .from('matchday_bonus_sources')
      .upsert({ matchday_id: matchdayId, source_matchday_id: sourceMatchdayId }, { onConflict: 'matchday_id' });
    if (sourceErr) throw sourceErr;

    console.log(`match ${coppa.id}: derivata da campionato giornata ${sourceMatchdayNumber}`);
  }

  console.log(`\nLineups coppa derivate inserite: ${insertedLineups}`);
}

main().catch((err: unknown) => {
  console.error('Derivazione coppa 2016-17 fallita:', err);
  process.exit(1);
});
