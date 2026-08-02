// packages/ingestion/scripts/import-bonus-2017-18.ts
//
// Import dei bonus/malus di Campionato 2017-18 dai 38 file
// docs/Fantacalcio 2017-2018/Campionato/formazioni-N.html — la stessa fonte
// già usata da import-season-2017-18.ts per le formazioni (vedi
// adapters/html-legacy/bonus.ts). Script separato e non un dry-run
// dell'import principale: qui i giocatori/formazioni sono già a DB da una
// fase precedente, questo script aggiunge SOLO i bonus/malus
// (upsertMatchdayBonuses risolve i giocatori per nome contro quelli già a
// DB, fallisce se un giocatore non è stato trovato).
//
// Niente derivazione Coppa (matchday_bonus_sources): la Coppa 2017-18 non
// ha formazioni per giocatore in questa fonte (solo classifiche/snapshot),
// vedi commento in testa a import-season-2017-18.ts.
//
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-bonus-2017-18.ts
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { FlatHtmlBonusAdapter } from '../adapters/html-legacy/bonus.js';

const SEASON_SLUG = '2017-18';
const COMPETITION_SLUG = 'campionato';
const CAMPIONATO_DIR = fileURLToPath(new URL('../../../docs/Fantacalcio 2017-2018/Campionato', import.meta.url));

async function importBonus(): Promise<void> {
  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);
  const adapter = new FlatHtmlBonusAdapter(SEASON_SLUG, COMPETITION_SLUG);

  const names = (await readdir(CAMPIONATO_DIR)).filter((name) => /^formazioni-\d+\.html$/.test(name));
  if (names.length === 0) throw new Error(`Nessun file formazioni-N.html trovato in ${CAMPIONATO_DIR}`);

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
