// packages/ingestion/scripts/import-bonus-2025-26.ts
//
// Import dei bonus/malus di Campionato 2025-26 dai 37 file HTML in
// docs/html/ (uno per giornata, vedi adapters/html-voti/bonus.ts). Diverso
// da import-season.ts: qui i giocatori/formazioni sono già stati importati
// da xlsx in una fase precedente, questo script aggiunge SOLO i bonus/malus
// (upsertMatchdayBonuses risolve i giocatori per nome contro quelli già a
// DB, fallisce se un giocatore non è stato trovato).
//
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-bonus-2025-26.ts
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { HtmlVotiBonusAdapter } from '../adapters/html-voti/bonus.js';

const SEASON_SLUG = '2025-26';
const COMPETITION_SLUG = 'campionato';
const HTML_DIR = fileURLToPath(new URL('../../../docs/html', import.meta.url));

async function importBonus(): Promise<void> {
  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);
  const adapter = new HtmlVotiBonusAdapter(SEASON_SLUG, COMPETITION_SLUG);

  const entries = (await readdir(HTML_DIR)).filter((name) => name.toLowerCase().endsWith('.html')).sort();
  if (entries.length === 0) throw new Error(`Nessun file .html trovato in ${HTML_DIR}`);

  for (const entry of entries) {
    const file = path.join(HTML_DIR, entry);
    const parsed = await adapter.parse(file);
    await repo.upsertMatchdayBonuses(parsed);
    console.log(`  giornata ${parsed.matchdayNumber}: ${parsed.players.length} giocatori`);
  }

  console.log(`\nImport bonus/malus ${SEASON_SLUG} completato (${entries.length} giornate).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  importBonus().catch((err: unknown) => {
    console.error('Import bonus fallito:', err);
    process.exit(1);
  });
}
