// packages/ingestion/scripts/import-bonus-fantacalcio-it.ts
//
// Import dei bonus/malus granulari da fantacalcio.it (Fase 7) per una
// stagione già importata da xlsx (rose/formazioni/calendario esistenti a
// DB). Legge i file HTML già scaricati in cache da
// fetch-bonus-fantacalcio-it.ts (docs/html-fantacalcio-it/{stagione}/),
// non fa fetch di rete verso il sito sorgente — separazione netta fra
// "scaricare" (script dedicato, ripetibile senza toccare Supabase) e
// "importare" (questo script, tocca Supabase).
//
// A differenza di import-bonus-2025-26.ts, questa fonte elenca TUTTI i
// giocatori di Serie A, non solo quelli presi all'asta nella lega: un nome
// può non esistere nel nostro DB per la stagione. upsertMatchdayBonuses
// fallisce rumorosamente su un giocatore non trovato (comportamento
// corretto per le altre fonti, dove ogni nome è per costruzione già in
// lega) — qui pre-filtriamo con resolvePlayerId PRIMA di chiamarlo, così
// il fail-loud condiviso resta valido per un nome davvero anomalo, mentre i
// giocatori mai presi all'asta vengono saltati con un conteggio in log.
//
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-bonus-fantacalcio-it.ts <stagione> [competizione]
//   es. dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-bonus-fantacalcio-it.ts 2024-25
import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { FantacalcioItBonusAdapter } from '../adapters/fantacalcio-it/bonus.js';
import type { BonusImport } from '../schema/imports.js';

async function importBonus(seasonSlug: string, competitionSlug: string): Promise<void> {
  const htmlDir = fileURLToPath(new URL(`../../../docs/html-fantacalcio-it/${seasonSlug}`, import.meta.url));
  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);
  const adapter = new FantacalcioItBonusAdapter(seasonSlug, competitionSlug);

  const entries = (await readdir(htmlDir)).filter((name) => name.toLowerCase().endsWith('.html')).sort();
  if (entries.length === 0) {
    throw new Error(`Nessun file .html in ${htmlDir} — lanciare prima fetch-bonus-fantacalcio-it.ts ${seasonSlug}`);
  }

  for (const entry of entries) {
    const html = await readFile(path.join(htmlDir, entry), 'utf-8');
    const parsed = await adapter.parse(html);

    const known: BonusImport['players'] = [];
    let skipped = 0;
    for (const player of parsed.players) {
      const playerId = await repo.resolvePlayerId(player.playerName);
      if (playerId) {
        known.push(player);
      } else {
        skipped++;
      }
    }

    await repo.upsertMatchdayBonuses({ ...parsed, players: known });
    console.log(
      `  giornata ${parsed.matchdayNumber}: ${known.length} giocatori importati, ${skipped} saltati (non in lega)`,
    );
  }

  console.log(`\nImport bonus/malus ${seasonSlug} completato (${entries.length} giornate).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const seasonSlug = process.argv[2];
  const competitionSlug = process.argv[3] ?? 'campionato';
  if (!seasonSlug) {
    console.error('Uso: tsx import-bonus-fantacalcio-it.ts <stagione, es. 2024-25> [competizione]');
    process.exit(1);
  }
  importBonus(seasonSlug, competitionSlug).catch((err: unknown) => {
    console.error('Import bonus fallito:', err);
    process.exit(1);
  });
}
