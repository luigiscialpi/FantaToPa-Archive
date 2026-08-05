// packages/ingestion/scripts/backfill-portiere-imbattuto.ts
//
// Fase 7, integrazione: portiere_imbattuto NON è derivabile dalla fonte
// pubblica fantacalcio.it usata da fantacalcio-it/bonus.ts (verificato,
// vedi commento in quell'adapter), ma è comunque ricavabile dal fantavoto
// UFFICIALE della lega già presente in lineup_players — che include il
// bonus "porta inviolata" del regolamento Mantra della lega stessa (house
// rule interna, non legato alla fonte fantacalcio.it).
//
// Evidenza raccolta (delta = fantavoto - voto per portieri titolari SENZA
// nessun altro bonus già importato per quella giornata, quindi già
// certamente un clean sheet secondo la fonte pubblica):
// - 2020-21/2021-22/2022-23: delta quasi sempre 0 -> regola non attiva.
// - 2023-24: 124/131 righe pulite hanno delta=+1 (95%).
// - 2024-25: 119/123 righe pulite hanno delta=+1 (97%).
// Le poche eccezioni sono tutte lo stesso giocatore (Montipò), la cui voce
// nella fonte pubblica ha un typo di codifica ("Montipo&#x27;" invece di
// "Montipò") che ne impedisce la risoluzione — gap di dati isolato, non
// invalida il pattern.
//
// Backfill CONSERVATIVO: aggiunge portiere_imbattuto SOLO quando non
// esiste già nessun'altra riga di bonus per quel giocatore+giornata (nessun
// gol subito, assist, cartellino, rigore...) e delta === +1 esatto. Casi
// combinati (es. clean sheet + assist nella stessa giornata) NON vengono
// backfillati: servirebbe un valore in punti per ogni bonus noto per
// scorporare il residuo con certezza, che qui non abbiamo (bonus_kinds non
// ha una colonna "points", solo l'etichetta — vedi commento in
// 20260731090000_player_matchday_bonuses.sql). Sono una minoranza residua,
// lasciata a una eventuale revisione manuale futura piuttosto che
// indovinata.
//
// Idempotente: inserisce solo dove NON esiste già nessuna riga di bonus per
// quel giocatore+giornata, quindi un secondo run non duplica nulla.
import { createIngestionClient } from '../lib/supabase-client.js';

const SEASON_LABELS = ['Stagione 2023/2024', 'Stagione 2024/2025'];

async function main(): Promise<void> {
  const client = createIngestionClient();
  let totalInserted = 0;

  for (const seasonLabel of SEASON_LABELS) {
    const { data: season, error: seasonErr } = await client
      .from('seasons')
      .select('id')
      .eq('label', seasonLabel)
      .single();
    if (seasonErr) throw seasonErr;

    const { data: roles, error: rolesErr } = await client
      .from('player_roles')
      .select('player_id')
      .eq('season_id', season.id)
      .eq('role_code', 'Por');
    if (rolesErr) throw rolesErr;
    const goalkeeperIds = [...new Set(roles!.map((r) => r.player_id))];
    if (!goalkeeperIds.length) continue;

    const { data: competitions, error: compErr } = await client
      .from('competitions')
      .select('id')
      .eq('season_id', season.id)
      .eq('kind_code', 'campionato');
    if (compErr) throw compErr;
    const competitionIds = competitions!.map((c) => c.id);
    if (!competitionIds.length) continue;

    const { data: matchdays, error: mdErr } = await client
      .from('matchdays')
      .select('id')
      .in('competition_id', competitionIds);
    if (mdErr) throw mdErr;
    const matchdayIds = matchdays!.map((m) => m.id);

    let matches: { id: string; matchday_id: string }[] = [];
    for (let i = 0; i < matchdayIds.length; i += 100) {
      const { data, error } = await client
        .from('matches')
        .select('id, matchday_id')
        .in('matchday_id', matchdayIds.slice(i, i + 100));
      if (error) throw error;
      matches = matches.concat(data);
    }
    const matchdayByMatch = new Map(matches.map((m) => [m.id, m.matchday_id]));

    let lineups: { id: string; match_id: string }[] = [];
    for (let i = 0; i < matches.length; i += 100) {
      const { data, error } = await client
        .from('lineups')
        .select('id, match_id')
        .in(
          'match_id',
          matches.slice(i, i + 100).map((m) => m.id),
        );
      if (error) throw error;
      lineups = lineups.concat(data);
    }
    const matchdayByLineup = new Map(lineups.map((l) => [l.id, matchdayByMatch.get(l.match_id)!]));

    let lineupRows: { voto: number; fantavoto: number; player_id: string; lineup_id: string }[] = [];
    for (let i = 0; i < lineups.length; i += 100) {
      const { data, error } = await client
        .from('lineup_players')
        .select('voto, fantavoto, player_id, lineup_id')
        .in(
          'lineup_id',
          lineups.slice(i, i + 100).map((l) => l.id),
        )
        .eq('slot', 'titolare')
        .in('player_id', goalkeeperIds)
        .not('voto', 'is', null)
        .not('fantavoto', 'is', null);
      if (error) throw error;
      lineupRows = lineupRows.concat(data);
    }

    const bonusCountByKey = new Map<string, number>();
    for (let i = 0; i < matchdayIds.length; i += 40) {
      const chunk = matchdayIds.slice(i, i + 40);
      let from = 0;
      while (true) {
        const { data, error } = await client
          .from('player_matchday_bonuses')
          .select('player_id, matchday_id')
          .in('matchday_id', chunk)
          .in('player_id', goalkeeperIds)
          .range(from, from + 999);
        if (error) throw error;
        for (const row of data) {
          const key = `${row.player_id}:${row.matchday_id}`;
          bonusCountByKey.set(key, (bonusCountByKey.get(key) ?? 0) + 1);
        }
        if (data.length < 1000) break;
        from += 1000;
      }
    }

    const toInsert: { matchday_id: string; player_id: string; kind_code: string; position_order: number }[] = [];
    for (const row of lineupRows) {
      const matchdayId = matchdayByLineup.get(row.lineup_id);
      if (!matchdayId) continue;
      const key = `${row.player_id}:${matchdayId}`;
      if ((bonusCountByKey.get(key) ?? 0) > 0) continue;
      const delta = Math.round((Number(row.fantavoto) - Number(row.voto)) * 10) / 10;
      if (delta !== 1) continue;
      toInsert.push({ matchday_id: matchdayId, player_id: row.player_id, kind_code: 'portiere_imbattuto', position_order: 1 });
    }

    if (toInsert.length > 0) {
      const { error } = await client.from('player_matchday_bonuses').insert(toInsert as never);
      if (error) throw new Error(`Errore inserimento portiere_imbattuto: ${error.message}`);
    }
    console.log(seasonLabel, '-> inserite', toInsert.length, 'righe portiere_imbattuto');
    totalInserted += toInsert.length;
  }

  console.log('Totale righe inserite:', totalInserted);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
