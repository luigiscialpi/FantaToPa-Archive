// packages/ingestion/scripts/import-bonus-2016-17.ts
//
// Import bonus/malus Campionato 2016-17 dai file
// docs/Fantacalcio 2016-2017/Campionato/fantatopa/formazioni-N.htm.
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-bonus-2016-17.ts
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { FlatHtmlBonusAdapter } from '../adapters/html-legacy/bonus.js';

const SEASON_SLUG = '2016-17';
const COMPETITION_SLUG = 'campionato';
const CAMPIONATO_DIR = fileURLToPath(new URL('../../../docs/Fantacalcio 2016-2017/Campionato/fantatopa', import.meta.url));

async function importBonus(): Promise<void> {
  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);
  const adapter = new FlatHtmlBonusAdapter(SEASON_SLUG, COMPETITION_SLUG);

  const names = (await readdir(CAMPIONATO_DIR)).filter((name) => /^formazioni-\d+\.htm$/i.test(name));
  if (names.length === 0) throw new Error(`Nessun file formazioni-N.htm trovato in ${CAMPIONATO_DIR}`);

  for (const name of names) {
    const file = path.join(CAMPIONATO_DIR, name);
    const parsed = await adapter.parse(file);
    await repo.upsertMatchdayBonuses(parsed);
    console.log(`  giornata ${parsed.matchdayNumber}: ${parsed.players.length} giocatori`);
  }

  console.log(`\nImport bonus/malus ${SEASON_SLUG} completato (${names.length} giornate).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  importBonus().catch((err: unknown) => {
    console.error('Import bonus fallito:', err);
    process.exit(1);
  });
}
