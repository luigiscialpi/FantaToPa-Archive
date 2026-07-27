// packages/ingestion/scripts/pilot-import-2025-26.ts
//
// Import pilota della stagione 2025-26 su Supabase. Da eseguire manualmente
// una volta con le env var SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { XlsxRosterAdapter } from '../adapters/xlsx/roster.js';
import { XlsxStandingsAdapter } from '../adapters/xlsx/standings.js';
import { XlsxCalendarAdapter } from '../adapters/xlsx/calendar.js';
import { XlsxLineupAdapter } from '../adapters/xlsx/lineup.js';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';

const SEASON_SLUG = '2025-26';
const SEASON_LABEL = 'Stagione 2025/2026';

const ROOT = fileURLToPath(new URL('../../../docs/Fantacalcio 2025-2026', import.meta.url));

const FILES = {
  roster: path.join(ROOT, 'Rose_fantatopa.xlsx'),
  campionato: {
    standings: path.join(ROOT, 'Campionato', 'Classifica_CAMPIONATO-FANTATOPA-2025-2026.xlsx'),
    calendar: path.join(ROOT, 'Campionato', 'Calendario_CAMPIONATO-FANTATOPA-2025-2026.xlsx'),
    lineups: path.join(ROOT, 'Campionato', 'Formazioni'),
  },
  coppa: {
    gironeA: {
      standings: path.join(ROOT, 'Coppa', 'Gruppo A', 'Classifica_COPPA-LELLE-GIR.-A.xlsx'),
      lineups: path.join(ROOT, 'Coppa', 'Gruppo A', 'Formazioni'),
    },
    gironeB: {
      standings: path.join(ROOT, 'Coppa', 'Gruppo B', 'Classifica_COPPA-LELLE-GIR.-B.xlsx'),
      lineups: path.join(ROOT, 'Coppa', 'Gruppo B', 'Formazioni'),
    },
    faseFinale: {
      calendar: path.join(ROOT, 'Coppa', 'Fase Finale', 'Calendario_COPPA-LELLE-FASE-FINALE.xlsx'),
      lineups: path.join(ROOT, 'Coppa', 'Fase Finale', 'Formazioni'),
    },
  },
};

const client = createIngestionClient();
const repo = new SupabaseSeasonRepository(client);

async function ensureSeason(): Promise<string> {
  const { data } = await client.from('seasons').select('id').eq('slug', SEASON_SLUG).maybeSingle();
  if (data) return data.id;

  const { data: created, error } = await client
    .from('seasons')
    .insert({ slug: SEASON_SLUG, label: SEASON_LABEL, starts_on: '2025-08-01', ends_on: '2026-06-30' })
    .select('id')
    .single();
  if (error || !created) throw new Error(`Errore creazione stagione: ${error?.message ?? 'riga assente'}`);
  console.log(`Stagione ${SEASON_SLUG} creata`);
  return created.id;
}

async function ensureLookups(): Promise<void> {
  await client.from('competition_kinds').upsert([
    { code: 'campionato', label: 'Campionato' },
    { code: 'coppa_girone', label: 'Coppa - Girone' },
    { code: 'coppa_fase_finale', label: 'Coppa - Fase Finale' },
  ]);
  await client.from('competition_formats').upsert([
    { code: 'girone_unico', label: 'Girone unico' },
    { code: 'gironi', label: 'Gironi' },
    { code: 'eliminazione_diretta', label: 'Eliminazione diretta' },
  ]);
  await client.from('roles').upsert([
    { code: 'Por', label: 'Portiere' },
    { code: 'Dc', label: 'Difensore centrale' },
    { code: 'Ds', label: 'Difensore sinistro' },
    { code: 'Dd', label: 'Difensore destro' },
    { code: 'B', label: 'Terzino' },
    { code: 'E', label: 'Esterno' },
    { code: 'M', label: 'Mediano' },
    { code: 'C', label: 'Centrocampista' },
    { code: 'W', label: 'Ala' },
    { code: 'T', label: 'Trequartista' },
    { code: 'A', label: 'Attaccante' },
    { code: 'Pc', label: 'Prima punta' },
  ]);
  await client.from('import_source_types').upsert([
    { code: 'xlsx', label: 'Excel' },
    { code: 'ocr_image', label: 'OCR da immagine' },
    { code: 'html_legacy', label: 'HTML legacy' },
    { code: 'manual', label: 'Manuale' },
  ]);
  console.log('Lookup tables popolate');
}

async function ensureCompetitions(seasonId: string): Promise<void> {
  const competitions = [
    { slug: 'campionato', name: 'Campionato FantaTopa', kind_code: 'campionato', format_code: 'girone_unico' },
    { slug: 'coppa-girone-a', name: 'Coppa Lelle - Girone A', kind_code: 'coppa_girone', format_code: 'gironi', parent: 'coppa' },
    { slug: 'coppa-girone-b', name: 'Coppa Lelle - Girone B', kind_code: 'coppa_girone', format_code: 'gironi', parent: 'coppa' },
    { slug: 'coppa-fase-finale', name: 'Coppa Lelle - Fase Finale', kind_code: 'coppa_fase_finale', format_code: 'eliminazione_diretta', parent: 'coppa' },
  ] as const;

  // Il parent "coppa" è solo un raggruppamento logico; per semplicità non
  // creiamo una competizione padre separata, impostiamo parent_competition_id
  // a null per tutte. Se in futuro serve il raggruppamento, si aggiunge.
  for (const comp of competitions) {
    const { data } = await client
      .from('competitions')
      .select('id')
      .eq('season_id', seasonId)
      .eq('slug', comp.slug)
      .maybeSingle();
    if (data) continue;

    const { error } = await client.from('competitions').insert({
      season_id: seasonId,
      name: comp.name,
      slug: comp.slug,
      kind_code: comp.kind_code,
      format_code: comp.format_code,
      parent_competition_id: null,
    });
    if (error) throw new Error(`Errore creazione competizione ${comp.slug}: ${error.message}`);
    console.log(`Competizione ${comp.slug} creata`);
  }
}

async function seedTeamsAndPlayersFromRoster(): Promise<void> {
  const adapter = new XlsxRosterAdapter(SEASON_SLUG);
  const roster = await adapter.parse(FILES.roster);

  const teamNames = new Set<string>();
  const playerNames = new Set<string>();

  for (const entry of roster.entries) {
    teamNames.add(entry.teamName.trim());
    playerNames.add(entry.playerName.trim());
  }

  await repo.upsertTeams([...teamNames].map((name) => ({ name })));
  await repo.upsertPlayers([...playerNames].map((name) => ({ name })));
  console.log(`Seed: ${teamNames.size} squadre, ${playerNames.size} giocatori`);
}

async function importRoster(): Promise<void> {
  const adapter = new XlsxRosterAdapter(SEASON_SLUG);
  const roster = await adapter.parse(FILES.roster);
  await repo.upsertRoster(roster);
  console.log(`Rosa importata: ${roster.entries.length} righe`);
}

async function importStandings(): Promise<void> {
  const campionato = new XlsxStandingsAdapter(SEASON_SLUG, 'campionato');
  await repo.upsertStandings(await campionato.parse(FILES.campionato.standings));
  console.log('Classifica campionato importata');

  const coppaA = new XlsxStandingsAdapter(SEASON_SLUG, 'coppa-girone-a');
  await repo.upsertStandings(await coppaA.parse(FILES.coppa.gironeA.standings));
  console.log('Classifica Coppa girone A importata');

  const coppaB = new XlsxStandingsAdapter(SEASON_SLUG, 'coppa-girone-b');
  await repo.upsertStandings(await coppaB.parse(FILES.coppa.gironeB.standings));
  console.log('Classifica Coppa girone B importata');
}

async function importCalendars(): Promise<void> {
  const campionato = new XlsxCalendarAdapter(SEASON_SLUG, 'campionato');
  await repo.upsertCalendar(await campionato.parse(FILES.campionato.calendar));
  console.log('Calendario campionato importato');

  const faseFinale = new XlsxCalendarAdapter(SEASON_SLUG, 'coppa-fase-finale');
  await repo.upsertCalendar(await faseFinale.parse(FILES.coppa.faseFinale.calendar));
  console.log('Calendario Coppa fase finale importato');
}

async function importLineups(folder: string, competitionSlug: string): Promise<void> {
  const files = (await readdir(folder))
    .filter((f) => f.toLowerCase().endsWith('.xlsx'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  for (const file of files) {
    const match = file.match(/(\d+)/);
    const matchdayNumber = match ? Number(match[1]) : 0;
    if (matchdayNumber === 0) {
      console.log(`  skip ${file}: numero giornata non trovato`);
      continue;
    }

    const adapter = new XlsxLineupAdapter(SEASON_SLUG, competitionSlug);
    const lineup = await adapter.parse(path.join(folder, file));
    await repo.upsertLineup(lineup);
    console.log(`  ${competitionSlug} giornata ${matchdayNumber}: ${lineup.matches.length} partite`);
  }
}

async function main(): Promise<void> {
  const seasonId = await ensureSeason();
  await ensureLookups();
  await ensureCompetitions(seasonId);

  await seedTeamsAndPlayersFromRoster();
  await importRoster();
  await importStandings();
  await importCalendars();

  await importLineups(FILES.campionato.lineups, 'campionato');
  await importLineups(FILES.coppa.gironeA.lineups, 'coppa-girone-a');
  await importLineups(FILES.coppa.gironeB.lineups, 'coppa-girone-b');
  await importLineups(FILES.coppa.faseFinale.lineups, 'coppa-fase-finale');

  console.log('\nImport pilota 2025-26 completato.');
}

main().catch((err: unknown) => {
  console.error('Import fallito:', err);
  process.exit(1);
});
