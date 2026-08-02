// packages/ingestion/scripts/derive-coppa-lineups.ts
//
// Deriva le formazioni mancanti di Coppa Lelle (Girone A/B e Fase Finale) per
// le stagioni 2020-21 e 2021-22 a partire dalle formazioni di Campionato,
// usando la mappatura giornate nota (5-8-11-14-17 per i gironi,
// 22-25-28-31-33 per la fase finale) e i punteggi reali trascritti dagli
// screenshot dell'utente (docs/Fantacalcio <season>/Coppa Lelle/*.jpg) per i
// gironi (le partite di fase finale esistono già con punteggio reale).
//
// Per ogni squadra/giornata: formazione, giocatori, voti e modificatore
// difesa sono copiati 1:1 dal Campionato (stessa prestazione reale, nessuna
// fonte Coppa indipendente esiste per queste due stagioni). Il valore
// mancante (field_advantage per la fase finale, defense_modifier per i
// gironi — dove field_advantage non si applica, vedi migration
// 20260729112311) viene calcolato come differenza esatta rispetto al
// punteggio reale già noto, così il dettaglio si riconcilia sempre col
// totale corretto.
//
// Script one-off, da eseguire una volta per stagione e poi lasciare (non è
// un adapter riutilizzabile: la mappatura e le fonti sono specifiche di
// queste due stagioni).
import 'dotenv/config';
import { createIngestionClient } from '../lib/supabase-client.js';

type SupabaseClientType = ReturnType<typeof createIngestionClient>;

const seasonArg = process.argv[2];
if (seasonArg !== '2020-21' && seasonArg !== '2021-22') {
  throw new Error('Uso: tsx derive-coppa-lineups.ts <2020-21|2021-22>');
}
const SEASON: '2020-21' | '2021-22' = seasonArg;

const GIRONE_MATCHDAY_TO_CAMPIONATO: Record<number, number> = { 1: 5, 2: 8, 3: 11, 4: 14, 5: 17 };
const FASE_FINALE_MATCHDAY_TO_CAMPIONATO: Record<number, number> = { 1: 22, 2: 25, 3: 28, 4: 31, 5: 33 };

// Punteggi reali giornata per giornata, trascritti dagli screenshot
// CalendarioGironeA/B.jpg (2020-21) e Calendario_COPPA-LELLE-GIRONE-A/B.jpg
// (2021-22) — verificati esatti contro standings.total_fantapoints già
// importato (somma delle 5 giornate = totale classifica, per ogni squadra).
const GIRONE_SCORES: Record<'2020-21' | '2021-22', Record<'A' | 'B', Record<number, Record<string, number>>>> = {
  '2020-21': {
    A: {
      1: { 'Biancoceleste Athletic Club': 73.5, 'Carloparola Fc': 81.0, 'Hertha Rallo': 82.5, 'Herta Bellinu': 65.0, Monster: 69.5 },
      2: { 'Biancoceleste Athletic Club': 75.5, 'Carloparola Fc': 74.5, 'Hertha Rallo': 62.5, 'Herta Bellinu': 74.0, Monster: 75.0 },
      3: { 'Biancoceleste Athletic Club': 79.5, 'Carloparola Fc': 84.5, 'Hertha Rallo': 69.0, 'Herta Bellinu': 86.0, Monster: 71.0 },
      4: { 'Biancoceleste Athletic Club': 68.5, 'Carloparola Fc': 72.0, 'Hertha Rallo': 84.0, 'Herta Bellinu': 61.5, Monster: 65.5 },
      5: { 'Biancoceleste Athletic Club': 79.5, 'Carloparola Fc': 77.0, 'Hertha Rallo': 70.0, 'Herta Bellinu': 75.5, Monster: 79.5 },
    },
    B: {
      1: { 'Real Cocu 2003 Fc': 74.0, 'Prozalpi S.F.': 70.5, 'SKAJAHNNY 04 F.C.': 68.0, Andreajax: 59.0, 'Deportivo La Carogna': 80.0 },
      2: { 'Real Cocu 2003 Fc': 81.0, 'Prozalpi S.F.': 74.0, 'SKAJAHNNY 04 F.C.': 73.5, Andreajax: 62.5, 'Deportivo La Carogna': 60.0 },
      3: { 'Real Cocu 2003 Fc': 77.5, 'Prozalpi S.F.': 70.5, 'SKAJAHNNY 04 F.C.': 65.5, Andreajax: 74.5, 'Deportivo La Carogna': 72.0 },
      4: { 'Real Cocu 2003 Fc': 65.5, 'Prozalpi S.F.': 69.5, 'SKAJAHNNY 04 F.C.': 75.5, Andreajax: 85.0, 'Deportivo La Carogna': 75.0 },
      5: { 'Real Cocu 2003 Fc': 78.0, 'Prozalpi S.F.': 67.0, 'SKAJAHNNY 04 F.C.': 85.0, Andreajax: 77.0, 'Deportivo La Carogna': 58.0 },
    },
  },
  '2021-22': {
    A: {
      1: { 'Real Cocu 2003 Fc': 80.5, 'Biancoceleste Athletic Club': 68.5, 'SKAJAHNNY 04 F.C.': 64.5, 'Herta Bellinu': 72.0, 'Deportivo La Carogna': 77.0 },
      2: { 'Real Cocu 2003 Fc': 78.0, 'Biancoceleste Athletic Club': 77.5, 'SKAJAHNNY 04 F.C.': 88.0, 'Herta Bellinu': 68.0, 'Deportivo La Carogna': 70.5 },
      3: { 'Real Cocu 2003 Fc': 65.0, 'Biancoceleste Athletic Club': 76.5, 'SKAJAHNNY 04 F.C.': 76.5, 'Herta Bellinu': 68.0, 'Deportivo La Carogna': 75.5 },
      4: { 'Real Cocu 2003 Fc': 76.5, 'Biancoceleste Athletic Club': 67.0, 'SKAJAHNNY 04 F.C.': 65.0, 'Herta Bellinu': 63.0, 'Deportivo La Carogna': 71.0 },
      5: { 'Real Cocu 2003 Fc': 69.5, 'Biancoceleste Athletic Club': 66.0, 'SKAJAHNNY 04 F.C.': 82.0, 'Herta Bellinu': 66.5, 'Deportivo La Carogna': 76.5 },
    },
    B: {
      1: { 'Prozalpi S.F.': 78.5, 'Carloparola Fc': 78.0, 'Hertha Rallo': 72.5, Andreajax: 68.5, Monster: 73.5 },
      2: { 'Prozalpi S.F.': 77.0, 'Carloparola Fc': 59.5, 'Hertha Rallo': 69.5, Andreajax: 70.0, Monster: 62.5 },
      3: { 'Prozalpi S.F.': 62.5, 'Carloparola Fc': 70.5, 'Hertha Rallo': 69.0, Andreajax: 87.5, Monster: 65.0 },
      4: { 'Prozalpi S.F.': 73.0, 'Carloparola Fc': 60.5, 'Hertha Rallo': 72.5, Andreajax: 78.5, Monster: 72.0 },
      5: { 'Prozalpi S.F.': 80.0, 'Carloparola Fc': 71.5, 'Hertha Rallo': 54.0, Andreajax: 76.0, Monster: 87.0 },
    },
  },
};

async function getSeasonId(supabase: SupabaseClientType, slug: string) {
  const { data, error } = await supabase.from('seasons').select('id').eq('slug', slug).single();
  if (error || !data) throw new Error(`Stagione non trovata: ${slug} (${error?.message})`);
  return data.id;
}

async function getCompetitionId(supabase: SupabaseClientType, seasonId: string, slug: string) {
  const { data, error } = await supabase
    .from('competitions')
    .select('id')
    .eq('season_id', seasonId)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

type CampLineupInfo = {
  lineupId: string;
  formation: string | null;
  defenseModifier: number;
  players: Array<{
    player_id: string;
    slot: string;
    position_order: number | null;
    voto: number | null;
    fantavoto: number | null;
    counts_for_total: boolean;
  }>;
};

// PostgREST/Supabase troncano silenziosamente le risposte a 1000 righe senza
// un .range() esplicito (nessun errore, nessun avviso — stesso bug già
// visto in apps/web/lib/queries/home.ts, commenti a getFieldedPlayers/
// "Ederson 53"). Con 5 giornate di Campionato × 10 squadre × ~22
// lineup_players, la query supera abbondantemente quel limite: usare sempre
// questo helper per le query .in() dentro buildCampionatoIndex.
async function fetchAllPaged<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function buildCampionatoIndex(
  supabase: SupabaseClientType,
  seasonId: string,
  matchdayNumbers: number[],
): Promise<Map<string, CampLineupInfo>> {
  const campCompId = await getCompetitionId(supabase, seasonId, 'campionato');
  if (!campCompId) throw new Error('Competizione campionato non trovata');

  const { data: matchdays, error: mdErr } = await supabase
    .from('matchdays')
    .select('id, number')
    .eq('competition_id', campCompId)
    .in('number', matchdayNumbers);
  if (mdErr) throw mdErr;

  const matchdayIdByNumber = new Map((matchdays ?? []).map((m) => [m.number, m.id]));

  const matches = await fetchAllPaged((from, to) =>
    supabase
      .from('matches')
      .select('id, matchday_id, home_team_id, away_team_id')
      .in('matchday_id', [...matchdayIdByNumber.values()])
      .range(from, to),
  );

  const lineups = await fetchAllPaged((from, to) =>
    supabase
      .from('lineups')
      .select('id, match_id, team_id, formation, defense_modifier')
      .in(
        'match_id',
        matches.map((m) => m.id),
      )
      .range(from, to),
  );

  const players = await fetchAllPaged((from, to) =>
    supabase
      .from('lineup_players')
      .select('lineup_id, player_id, slot, position_order, voto, fantavoto, counts_for_total')
      .in(
        'lineup_id',
        lineups.map((l) => l.id),
      )
      .range(from, to),
  );

  const playersByLineup = new Map<string, CampLineupInfo['players']>();
  for (const p of players) {
    const arr = playersByLineup.get(p.lineup_id) ?? [];
    arr.push(p);
    playersByLineup.set(p.lineup_id, arr);
  }

  const matchdayNumberByMatchId = new Map<string, number>();
  for (const m of matches) {
    const number = [...matchdayIdByNumber.entries()].find(([, id]) => id === m.matchday_id)?.[0];
    if (number !== undefined) matchdayNumberByMatchId.set(m.id, number);
  }

  const index = new Map<string, CampLineupInfo>();
  for (const l of lineups) {
    const number = matchdayNumberByMatchId.get(l.match_id);
    if (number === undefined) continue;
    const players = playersByLineup.get(l.id) ?? [];
    if (players.length === 0) {
      console.warn(`  [attenzione] Campionato giornata ${number}, team ${l.team_id}: 0 lineup_players trovati, lineup scartata dall'indice (probabile bug a monte, non un plug valido).`);
      continue;
    }
    index.set(`${number}:${l.team_id}`, {
      lineupId: l.id,
      formation: l.formation,
      defenseModifier: l.defense_modifier,
      players,
    });
  }
  return index;
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
  fixedFieldAdvantage: number | null,
) {
  const { data: existing } = await supabase
    .from('lineups')
    .select('id')
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .maybeSingle();
  if (existing) {
    console.log(`  lineup già presente per match=${matchId} team=${teamId}, skip`);
    return;
  }

  const sum = sumFantavoto(camp.players);
  // defense_modifier/field_advantage sono colonne integer: il plug va
  // arrotondato. Se il residuo non è già (quasi) intero, la formazione
  // Campionato copiata non è prestazione-per-prestazione identica a quella
  // Coppa (fisiologico per una derivazione, nessuna fonte Coppa indipendente
  // esiste per queste due stagioni) — logghiamo lo scarto per trasparenza.
  const rawDefenseModifier = fixedFieldAdvantage !== null ? realScore - sum : camp.defenseModifier;
  const rawFieldAdvantage =
    fixedFieldAdvantage !== null ? fixedFieldAdvantage : realScore - sum - camp.defenseModifier;
  const defenseModifier = Math.round(rawDefenseModifier);
  const fieldAdvantage = Math.round(rawFieldAdvantage);
  const rounding = rawDefenseModifier - defenseModifier + (rawFieldAdvantage - fieldAdvantage);
  if (Math.abs(rounding) > 0.01) {
    console.log(
      `  [nota] match=${matchId} team=${teamId}: residuo non intero dopo arrotondamento (${rounding.toFixed(2)}) — piccola imprecisione nota, il totale reale (${realScore}) resta quello mostrato in classifica/calendario, non il dettaglio formazione`,
    );
  }

  const { data: newLineup, error: insErr } = await supabase
    .from('lineups')
    .insert({
      match_id: matchId,
      team_id: teamId,
      formation: camp.formation,
      defense_modifier: defenseModifier,
      field_advantage: fieldAdvantage,
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
}

async function linkMatchdaySource(supabase: SupabaseClientType, matchdayId: string, sourceMatchdayId: string) {
  const { error } = await supabase
    .from('matchday_bonus_sources')
    .upsert({ matchday_id: matchdayId, source_matchday_id: sourceMatchdayId }, { onConflict: 'matchday_id' });
  if (error) throw error;
}

async function deriveFaseFinale(supabase: SupabaseClientType, seasonId: string) {
  const campIndex = await buildCampionatoIndex(supabase, seasonId, Object.values(FASE_FINALE_MATCHDAY_TO_CAMPIONATO));
  const campCompId = await getCompetitionId(supabase, seasonId, 'campionato');
  const ffCompId = await getCompetitionId(supabase, seasonId, 'coppa-fase-finale');
  if (!ffCompId || !campCompId) throw new Error('Competizioni fase finale/campionato non trovate');

  const { data: campMatchdays } = await supabase
    .from('matchdays')
    .select('id, number')
    .eq('competition_id', campCompId)
    .in('number', Object.values(FASE_FINALE_MATCHDAY_TO_CAMPIONATO));
  const campMatchdayIdByNumber = new Map((campMatchdays ?? []).map((m) => [m.number, m.id]));

  const { data: ffMatchdays } = await supabase.from('matchdays').select('id, number').eq('competition_id', ffCompId);
  const { data: ffMatches } = await supabase
    .from('matches')
    .select('id, matchday_id, home_team_id, away_team_id, home_score, away_score')
    .in('matchday_id', (ffMatchdays ?? []).map((m) => m.id));

  console.log(`\n=== Fase Finale: ${ffMatches?.length ?? 0} partite ===`);
  for (const match of ffMatches ?? []) {
    const ffNumber = ffMatchdays!.find((m) => m.id === match.matchday_id)!.number;
    const campNumber = FASE_FINALE_MATCHDAY_TO_CAMPIONATO[ffNumber]!;
    await linkMatchdaySource(supabase, match.matchday_id, campMatchdayIdByNumber.get(campNumber)!);

    const sides: Array<{ teamId: string; score: number | null }> = [
      { teamId: match.home_team_id, score: match.home_score },
      ...(match.away_team_id ? [{ teamId: match.away_team_id, score: match.away_score }] : []),
    ];
    for (const side of sides) {
      if (side.score === null) {
        console.log(`  ff${ffNumber}: punteggio nullo per team=${side.teamId}, skip`);
        continue;
      }
      const camp = campIndex.get(`${campNumber}:${side.teamId}`);
      if (!camp) {
        console.log(`  ff${ffNumber} (camp.${campNumber}): nessuna formazione Campionato per team=${side.teamId}, skip`);
        continue;
      }
      await insertDerivedLineup(supabase, match.id, side.teamId, camp, side.score, null);
    }
  }
}

async function deriveGirone(supabase: SupabaseClientType, seasonId: string, girone: 'A' | 'B') {
  const slug = girone === 'A' ? 'coppa-girone-a' : 'coppa-girone-b';
  const compId = await getCompetitionId(supabase, seasonId, slug);
  if (!compId) throw new Error(`Competizione ${slug} non trovata`);

  const { data: existingMatchdays } = await supabase.from('matchdays').select('id').eq('competition_id', compId);
  if ((existingMatchdays?.length ?? 0) > 0) {
    console.log(`\n=== Girone ${girone}: matchdays già presenti (${existingMatchdays!.length}), skip creazione ===`);
    return;
  }

  const campIndex = await buildCampionatoIndex(supabase, seasonId, Object.values(GIRONE_MATCHDAY_TO_CAMPIONATO));
  const campCompId = await getCompetitionId(supabase, seasonId, 'campionato');
  const { data: campMatchdays } = await supabase
    .from('matchdays')
    .select('id, number')
    .eq('competition_id', campCompId!)
    .in('number', Object.values(GIRONE_MATCHDAY_TO_CAMPIONATO));
  const campMatchdayIdByNumber = new Map((campMatchdays ?? []).map((m) => [m.number, m.id]));

  const scores = GIRONE_SCORES[SEASON][girone];
  console.log(
    `\n=== Girone ${girone}: creo 5 giornate (pattern "solo": nessuna fonte reale del pairing per queste stagioni, formula 1 → pairing cosmetico irrilevante) ===`,
  );

  for (let number = 1; number <= 5; number += 1) {
    const campNumber = GIRONE_MATCHDAY_TO_CAMPIONATO[number]!;
    const { data: newMatchday, error: mdErr } = await supabase
      .from('matchdays')
      .insert({ competition_id: compId, number, label: `${number}ª giornata (${campNumber}ª di Serie A)` })
      .select('id')
      .single();
    if (mdErr || !newMatchday) throw new Error(`Insert matchday fallito: ${mdErr?.message}`);
    await linkMatchdaySource(supabase, newMatchday.id, campMatchdayIdByNumber.get(campNumber)!);

    for (const [teamName, score] of Object.entries(scores[number]!)) {
      const { data: teamSeason, error: tsErr } = await supabase
        .from('team_seasons')
        .select('team_id')
        .eq('season_id', seasonId)
        .eq('display_name', teamName)
        .maybeSingle();
      if (tsErr || !teamSeason) {
        console.log(`  giornata ${number}: squadra non trovata "${teamName}", skip`);
        continue;
      }

      const { data: newMatch, error: matchErr } = await supabase
        .from('matches')
        .insert({ matchday_id: newMatchday.id, home_team_id: teamSeason.team_id, away_team_id: null, home_score: score })
        .select('id')
        .single();
      if (matchErr || !newMatch) throw new Error(`Insert match fallito: ${matchErr?.message}`);

      const camp = campIndex.get(`${campNumber}:${teamSeason.team_id}`);
      if (!camp) {
        console.log(`  giornata ${number}: nessuna formazione Campionato per "${teamName}", skip lineup`);
        continue;
      }
      await insertDerivedLineup(supabase, newMatch.id, teamSeason.team_id, camp, score, 0);
    }
  }
}

async function main() {
  const supabase = createIngestionClient();
  const seasonId = await getSeasonId(supabase, SEASON);

  await deriveFaseFinale(supabase, seasonId);
  await deriveGirone(supabase, seasonId, 'A');
  await deriveGirone(supabase, seasonId, 'B');

  console.log('\nFatto.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
