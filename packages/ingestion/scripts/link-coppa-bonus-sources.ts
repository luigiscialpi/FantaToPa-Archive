// packages/ingestion/scripts/link-coppa-bonus-sources.ts
//
// Popola `matchday_bonus_sources` per le stagioni 2022-23, 2023-24 e 2024-25.
// Mappatura confermata empiricamente via verifica al 100% dei voti giocatori:
//   Gironi A e B (G1..G5): Campionato G5, G8, G11, G14, G17
//   Fase Finale (G1..G5): Campionato G22, G25, G28, G31, G33
//   Spareggio (G1, solo 2024-25): Campionato G32
import { createIngestionClient } from '../lib/supabase-client.js';

const MAPPINGS: Record<string, Record<string, Record<number, number>>> = {
  '2022-23': {
    'coppa-girone-a': { 1: 5, 2: 8, 3: 11, 4: 14, 5: 17 },
    'coppa-girone-b': { 1: 5, 2: 8, 3: 11, 4: 14, 5: 17 },
    'coppa-fase-finale': { 1: 22, 2: 25, 3: 28, 4: 31, 5: 33 },
  },
  '2023-24': {
    'coppa-girone-a': { 1: 5, 2: 8, 3: 11, 4: 14, 5: 17 },
    'coppa-girone-b': { 1: 5, 2: 8, 3: 11, 4: 14, 5: 17 },
    'coppa-fase-finale': { 1: 22, 2: 25, 3: 28, 4: 31, 5: 33 },
  },
  '2024-25': {
    'coppa-girone-a': { 1: 5, 2: 8, 3: 11, 4: 14, 5: 17 },
    'coppa-girone-b': { 1: 5, 2: 8, 3: 11, 4: 14, 5: 17 },
    'coppa-fase-finale': { 1: 22, 2: 25, 3: 28, 4: 31, 5: 33 },
    'coppa-spareggio': { 1: 32 },
  },
};

async function main() {
  const client = createIngestionClient();

  for (const [seasonSlug, compMappings] of Object.entries(MAPPINGS)) {
    console.log(`\n--- Popolamento matchday_bonus_sources per ${seasonSlug} ---`);
    const { data: season, error: sErr } = await client
      .from('seasons')
      .select('id')
      .eq('slug', seasonSlug)
      .single();

    if (sErr || !season) {
      throw new Error(`Stagione non trovata: ${seasonSlug}`);
    }

    // Campionato matchdays per numero
    const { data: campComp } = await client
      .from('competitions')
      .select('id')
      .eq('season_id', season.id)
      .eq('slug', 'campionato')
      .single();

    if (!campComp) throw new Error(`Campionato non trovato per ${seasonSlug}`);

    const { data: campMatchdays } = await client
      .from('matchdays')
      .select('id, number')
      .eq('competition_id', campComp.id);

    const campMatchdayByNumber = new Map<number, string>();
    for (const cmd of campMatchdays || []) {
      campMatchdayByNumber.set(cmd.number, cmd.id);
    }

    for (const [coppaSlug, matchdayMap] of Object.entries(compMappings)) {
      const { data: coppaComp } = await client
        .from('competitions')
        .select('id')
        .eq('season_id', season.id)
        .eq('slug', coppaSlug)
        .maybeSingle();

      if (!coppaComp) {
        console.warn(`Competizione ${coppaSlug} non trovata per ${seasonSlug}, skip.`);
        continue;
      }

      const { data: coppaMatchdays } = await client
        .from('matchdays')
        .select('id, number')
        .eq('competition_id', coppaComp.id);

      for (const cmd of coppaMatchdays || []) {
        const sourceCampNumber = matchdayMap[cmd.number];
        if (!sourceCampNumber) {
          console.warn(`Nessuna mappatura definita per ${coppaSlug} giornata ${cmd.number}`);
          continue;
        }

        const sourceMatchdayId = campMatchdayByNumber.get(sourceCampNumber);
        if (!sourceMatchdayId) {
          throw new Error(`Giornata di Campionato ${sourceCampNumber} non trovata in DB per ${seasonSlug}`);
        }

        const { error: upsertErr } = await client
          .from('matchday_bonus_sources')
          .upsert(
            { matchday_id: cmd.id, source_matchday_id: sourceMatchdayId },
            { onConflict: 'matchday_id' },
          );

        if (upsertErr) throw upsertErr;

        console.log(`  ${coppaSlug} G${cmd.number} (${cmd.id}) -> Campionato G${sourceCampNumber} (${sourceMatchdayId})`);
      }
    }
  }

  console.log('\nmatchday_bonus_sources popolata con successo per tutte le 3 stagioni.');
}

main().catch((err: unknown) => {
  console.error('Errore:', err);
  process.exit(1);
});
