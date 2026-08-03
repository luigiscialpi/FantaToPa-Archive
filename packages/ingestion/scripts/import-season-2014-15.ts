// packages/ingestion/scripts/import-season-2014-15.ts
//
// Import dedicato per la stagione 2014-15 (mirror HTML legacy "flat").
//
// Dati disponibili nel dump locale:
//   - Campionato: classifica, calendario, rose aggregate (tutte-le-rose), formazioni (38 giornate).
//   - Coppa: il menu competizione esiste, ma le pagine endpoint competizione
//     (classifica/calendario/formazioni per id Coppa) non sono presenti nel mirror.
//     ponytail: importiamo solo dati verificabili nel dump, senza inventare snapshot mancanti.
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-season-2014-15.ts [--dry-run]
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { FlatHtmlStandingsAdapter } from '../adapters/html-legacy/standings.js';
import { FlatHtmlCalendarAdapter } from '../adapters/html-legacy/calendar.js';
import { FlatHtmlRosterAdapter } from '../adapters/html-legacy/roster.js';
import { FlatHtmlLineupAdapter } from '../adapters/html-legacy/lineup.js';
import {
  ensureSeason,
  ensureLookups,
  ensureCompetitions,
  seedTeamsFromNames,
} from './import-season.js';

const DOCS_ROOT = fileURLToPath(new URL('../../../docs/Fantacalcio 2014-2015', import.meta.url));
const BASE_DIR = path.join(DOCS_ROOT, 'leghe.fantagazzetta.com', 'fantatopa');

const SEASON = {
  slug: '2014-15',
  label: 'Stagione 2014/2015',
  startsOn: '2014-08-01',
  endsOn: '2015-06-30',
};

const CONFIRMED_TEAM_MERGES: { canonicalName: string; seasonAlias: string }[] = [
  { canonicalName: 'FC Steaua Ste', seasonAlias: 'Steaua Ste' },
  { canonicalName: 'Nemesis FC', seasonAlias: 'Nemesis 08 FC' },
  { canonicalName: 'Panothinaikos', seasonAlias: 'Panothinaikos 2014' },
  { canonicalName: 'Uber Alles Fussball Club', seasonAlias: 'Uber Alles FC' },
  { canonicalName: 'BBSATLPR', seasonAlias: 'Roots Bologna' },
];

// Squadre confermate dall'utente come realmente nuove (non alias).
const CONFIRMED_NEW_TEAMS = ['pierpaologranata'];

async function discoverLineupFiles(): Promise<string[]> {
  const names = (await readdir(BASE_DIR)).filter((name) => /^formazioni_.*\.html$/i.test(name));
  if (names.length === 0) throw new Error(`Nessun file formazioni_*.html trovato in ${BASE_DIR}`);
  return names.map((name) => path.join(BASE_DIR, name));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const standingsFile = path.join(BASE_DIR, 'classifica.html');
  const calendarFile = path.join(BASE_DIR, 'calendario.html');
  const rosterFile = path.join(BASE_DIR, 'tutte-le-rose.html');
  const creditsFile = path.join(BASE_DIR, 'squadre.html');

  const standings = await new FlatHtmlStandingsAdapter(SEASON.slug, 'campionato').parse(standingsFile);
  const calendar = await new FlatHtmlCalendarAdapter(SEASON.slug, 'campionato').parse(calendarFile);
  const roster = await new FlatHtmlRosterAdapter(SEASON.slug, creditsFile).parse([rosterFile]);

  const lineupFiles = await discoverLineupFiles();
  const lineupAdapter = new FlatHtmlLineupAdapter(SEASON.slug, 'campionato');
  const lineups = [];
  for (const file of lineupFiles) {
    try {
      lineups.push(await lineupAdapter.parse(file));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Nessun box-match trovato')) {
        console.warn(`Formazioni saltate (nessun match): ${path.basename(file)}`);
        continue;
      }
      throw err;
    }
  }
  if (lineups.length === 0) {
    throw new Error('Nessuna formazione valida trovata nei file formati formazioni_*.html');
  }
  lineups.sort((a, b) => a.matchdayNumber - b.matchdayNumber);

  console.log(`Classifica campionato: ${standings.rows.length} squadre`);
  console.log(`Calendario campionato: ${calendar.matchdays.length} giornate`);
  console.log(`Rosa: ${roster.entries.length} righe`);
  console.log(
    `Formazioni: ${lineups.length} giornate lette (${lineups[0]?.matchdayNumber}-${lineups[lineups.length - 1]?.matchdayNumber})`,
  );

  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);

  const teamNames = new Set(roster.entries.map((entry) => entry.teamName.trim()));

  console.log('\nRisoluzione squadre contro il registro esistente (teams/team_aliases):');
  for (const name of teamNames) {
    const teamId = await repo.resolveTeamId(name);
    console.log(`  ${teamId ? 'trovata  ' : 'NUOVA    '} "${name}"`);
  }

  if (dryRun) {
    console.log('\n--dry-run: adapter eseguiti, nessuna scrittura su Supabase.');
    return;
  }

  const seasonId = await ensureSeason(client, SEASON);
  await ensureLookups(client);
  await ensureCompetitions(client, seasonId, {});

  await repo.upsertTeams(CONFIRMED_TEAM_MERGES.map((m) => ({ name: m.canonicalName, aliases: [m.seasonAlias] })));
  await repo.upsertTeams(CONFIRMED_NEW_TEAMS.map((name) => ({ name })));

  await seedTeamsFromNames(seasonId, teamNames, repo);
  console.log(`Seed squadre: ${teamNames.size} squadre`);

  const playerNames = new Set(roster.entries.map((entry) => entry.playerName.trim()));
  for (const lineup of lineups) {
    for (const match of lineup.matches) {
      const sides = match.away ? [match.home, match.away] : [match.home];
      for (const side of sides) {
        for (const player of side.players) playerNames.add(player.playerName.trim());
      }
    }
  }
  await repo.upsertPlayers([...playerNames].map((name) => ({ name })));
  console.log(`Seed giocatori: ${playerNames.size}`);

  await repo.upsertRoster(roster);
  await repo.upsertStandings(standings);
  await repo.upsertCalendar(calendar);

  for (const lineup of lineups) {
    await repo.upsertLineup(lineup);
  }
  console.log(`Formazioni caricate: ${lineups.length} giornate`);

  console.log(`\nImport ${SEASON.slug} completato.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error(`Import ${SEASON.slug} fallito:`, err);
    process.exit(1);
  });
}
