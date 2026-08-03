// packages/ingestion/scripts/import-bonus-2014-15.ts
//
// Import bonus/malus Campionato 2014-15 dai file
// docs/Fantacalcio 2014-2015/leghe.fantagazzetta.com/fantatopa/formazioni_*.html.
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-bonus-2014-15.ts
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { FlatHtmlBonusAdapter } from '../adapters/html-legacy/bonus.js';

const SEASON_SLUG = '2014-15';
const COMPETITION_SLUG = 'campionato';
const BASE_DIR = fileURLToPath(new URL('../../../docs/Fantacalcio 2014-2015/leghe.fantagazzetta.com/fantatopa', import.meta.url));

async function importBonus(): Promise<void> {
  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);
  const adapter = new FlatHtmlBonusAdapter(SEASON_SLUG, COMPETITION_SLUG);

  const names = (await readdir(BASE_DIR)).filter((name) => /^formazioni_.*\.html$/i.test(name));
  if (names.length === 0) throw new Error(`Nessun file formazioni_*.html trovato in ${BASE_DIR}`);

  const parsedByMatchday = new Map<number, { file: string; players: number; payload: Awaited<ReturnType<typeof adapter.parse>> }>();
  const skipped: string[] = [];

  for (const name of names) {
    const file = path.join(BASE_DIR, name);
    try {
      const parsed = await adapter.parse(file);
      if (parsedByMatchday.has(parsed.matchdayNumber)) {
        const previous = parsedByMatchday.get(parsed.matchdayNumber)!;
        throw new Error(
          `Giornata duplicata ${parsed.matchdayNumber}: ${path.basename(previous.file)} e ${name}`,
        );
      }
      parsedByMatchday.set(parsed.matchdayNumber, { file, players: parsed.players.length, payload: parsed });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Nessun giocatore trovato')) {
        skipped.push(name);
        continue;
      }
      throw err;
    }
  }

  const ordered = [...parsedByMatchday.values()].sort((a, b) => a.payload.matchdayNumber - b.payload.matchdayNumber);
  for (const item of ordered) {
    await repo.upsertMatchdayBonuses(item.payload);
    console.log(`  giornata ${item.payload.matchdayNumber}: ${item.players} giocatori (${path.basename(item.file)})`);
  }

  if (skipped.length > 0) {
    console.log(`\nFile saltati senza righe giocatore: ${skipped.join(', ')}`);
  }

  console.log(`\nImport bonus/malus ${SEASON_SLUG} completato (${ordered.length} giornate).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  importBonus().catch((err: unknown) => {
    console.error('Import bonus fallito:', err);
    process.exit(1);
  });
}
