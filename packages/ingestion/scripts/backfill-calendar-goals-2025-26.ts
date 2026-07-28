// packages/ingestion/scripts/backfill-calendar-goals-2025-26.ts
//
// Una tantum, da eseguire dopo la migrazione che ha aggiunto
// matches.home_goals/away_goals: ri-legge SOLO i calendari 2025-26 (upsert
// idempotente su matchday_id+home_team_id+away_team_id, vedi
// supabase-season-repository.ts) per popolare le due colonne sulle partite
// già importate. Non tocca rose/formazioni/classifiche: quelle non sono
// cambiate, non serve ri-eseguire tutto pilot-import-2025-26.ts.
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { XlsxCalendarAdapter } from '../adapters/xlsx/calendar.js';

const SEASON_SLUG = '2025-26';
const ROOT = fileURLToPath(new URL('../../../docs/Fantacalcio 2025-2026', import.meta.url));

const FILES = {
  campionato: path.join(ROOT, 'Campionato', 'Calendario_CAMPIONATO-FANTATOPA-2025-2026.xlsx'),
  coppaFaseFinale: path.join(ROOT, 'Coppa', 'Fase Finale', 'Calendario_COPPA-LELLE-FASE-FINALE.xlsx'),
};

async function main(): Promise<void> {
  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);

  const campionato = new XlsxCalendarAdapter(SEASON_SLUG, 'campionato');
  await repo.upsertCalendar(await campionato.parse(FILES.campionato));
  console.log('Calendario campionato ri-importato (home_goals/away_goals backfillati)');

  const faseFinale = new XlsxCalendarAdapter(SEASON_SLUG, 'coppa-fase-finale');
  await repo.upsertCalendar(await faseFinale.parse(FILES.coppaFaseFinale));
  console.log('Calendario Coppa fase finale ri-importato (home_goals/away_goals backfillati)');
}

main().catch((err: unknown) => {
  console.error('Backfill fallito:', err);
  process.exit(1);
});
