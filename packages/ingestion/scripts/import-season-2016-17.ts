// packages/ingestion/scripts/import-season-2016-17.ts
//
// Import dedicato per la stagione 2016-17: stessa famiglia di fonte HTML
// legacy "flat" del 2017-18 ma con percorso diverso (Campionato/fantatopa)
// e file .htm invece di .html.
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-season-2016-17.ts [--dry-run]
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { FlatHtmlStandingsAdapter } from '../adapters/html-legacy/standings.js';
import { FlatHtmlCalendarAdapter, FlatHtmlFinalMatchAdapter } from '../adapters/html-legacy/calendar.js';
import { FlatHtmlRosterAdapter } from '../adapters/html-legacy/roster.js';
import { FlatHtmlLineupAdapter } from '../adapters/html-legacy/lineup.js';
import {
  ensureSeason,
  ensureLookups,
  ensureCompetitions,
  seedTeamsFromNames,
} from './import-season.js';

const DOCS_ROOT = fileURLToPath(new URL('../../../docs/Fantacalcio 2016-2017', import.meta.url));
const CAMPIONATO_DIR = path.join(DOCS_ROOT, 'Campionato', 'fantatopa');
const ROSTER_DIR = path.join(CAMPIONATO_DIR, 'dettaglio-rosa');
const CREDITS_DIR = path.join(CAMPIONATO_DIR, 'dettaglio-squadra');
const COPPA_DIR = path.join(DOCS_ROOT, 'Coppa Lelle');

const SEASON = {
  slug: '2016-17',
  label: 'Stagione 2016/2017',
  startsOn: '2016-08-01',
  endsOn: '2017-06-30',
};

const CONFIRMED_TEAM_MERGES: { canonicalName: string; seasonAlias: string }[] = [
  { canonicalName: 'FC Steaua Ste', seasonAlias: 'Steaua Ste' },
  { canonicalName: 'Nemesis FC', seasonAlias: 'Nemesis 08 FC' },
  { canonicalName: 'Panothinaikos', seasonAlias: 'Panothinaikos 2014' },
];

async function discoverSingleHtm(dir: string): Promise<string> {
  const names = (await readdir(dir)).filter((name) => name.toLowerCase().endsWith('.htm'));
  if (names.length !== 1) {
    throw new Error(`Atteso esattamente 1 file .htm in ${dir}, trovati ${names.length}`);
  }
  return path.join(dir, names[0]!);
}

async function discoverRosterFiles(): Promise<string[]> {
  const teamDirs = await readdir(ROSTER_DIR, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of teamDirs) {
    if (!entry.isDirectory()) continue;
    const teamDir = path.join(ROSTER_DIR, entry.name);
    files.push(await discoverSingleHtm(teamDir));
  }
  return files;
}

async function discoverCreditFiles(): Promise<string[]> {
  const teamDirs = await readdir(CREDITS_DIR, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of teamDirs) {
    if (!entry.isDirectory()) continue;
    const teamDir = path.join(CREDITS_DIR, entry.name);
    files.push(await discoverSingleHtm(teamDir));
  }
  return files;
}

async function discoverLineupFiles(): Promise<string[]> {
  const names = (await readdir(CAMPIONATO_DIR)).filter((name) => /^formazioni-\d+\.htm$/i.test(name));
  if (names.length === 0) throw new Error(`Nessun file formazioni-N.htm trovato in ${CAMPIONATO_DIR}`);
  return names.map((name) => path.join(CAMPIONATO_DIR, name));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const campionatoStandingsFile = path.join(CAMPIONATO_DIR, 'classifica.htm');
  const campionatoCalendarFile = path.join(CAMPIONATO_DIR, 'calendario.htm');

  const gironeAFile = await discoverSingleHtm(
    path.join(COPPA_DIR, 'Girone A', 'leghe.fantagazzetta.com', 'fantatopa', 'home'),
  );
  const gironeBFile = await discoverSingleHtm(
    path.join(COPPA_DIR, 'Girone B', 'leghe.fantagazzetta.com', 'fantatopa', 'home'),
  );
  const secondaFaseFile = await discoverSingleHtm(
    path.join(COPPA_DIR, 'Seconda fase', 'leghe.fantagazzetta.com', 'fantatopa', 'home'),
  );
  const faseFinaleFile = await discoverSingleHtm(
    path.join(COPPA_DIR, 'Fase finale', 'leghe.fantagazzetta.com', 'fantatopa', 'home'),
  );

  const campionatoStandings = await new FlatHtmlStandingsAdapter(SEASON.slug, 'campionato').parse(
    campionatoStandingsFile,
  );
  const campionatoCalendar = await new FlatHtmlCalendarAdapter(SEASON.slug, 'campionato').parse(campionatoCalendarFile);
  const gironeAStandings = await new FlatHtmlStandingsAdapter(SEASON.slug, 'coppa-girone-a').parse(gironeAFile);
  const gironeBStandings = await new FlatHtmlStandingsAdapter(SEASON.slug, 'coppa-girone-b').parse(gironeBFile);
  const secondaFaseStandings = await new FlatHtmlStandingsAdapter(SEASON.slug, 'coppa-seconda-fase').parse(
    secondaFaseFile,
  );
  const secondaFaseCalendar = await new FlatHtmlFinalMatchAdapter(SEASON.slug, 'coppa-seconda-fase').parse(
    secondaFaseFile,
  );
  const faseFinaleCalendar = await new FlatHtmlFinalMatchAdapter(SEASON.slug, 'coppa-fase-finale').parse(faseFinaleFile);

  const rosterFiles = await discoverRosterFiles();
  const creditFiles = await discoverCreditFiles();
  const roster = await new FlatHtmlRosterAdapter(SEASON.slug, creditFiles).parse(rosterFiles);

  const lineupFiles = await discoverLineupFiles();
  const lineupAdapter = new FlatHtmlLineupAdapter(SEASON.slug, 'campionato');
  const lineups = await Promise.all(lineupFiles.map((file) => lineupAdapter.parse(file)));
  lineups.sort((a, b) => a.matchdayNumber - b.matchdayNumber);

  console.log(`Classifica campionato: ${campionatoStandings.rows.length} squadre`);
  console.log(`Calendario campionato: ${campionatoCalendar.matchdays.length} giornate`);
  console.log(`Classifica Coppa Girone A: ${gironeAStandings.rows.length} squadre`);
  console.log(`Classifica Coppa Girone B: ${gironeBStandings.rows.length} squadre`);
  console.log(`Classifica Coppa Seconda Fase: ${secondaFaseStandings.rows.length} squadre`);
  const secondaFaseMatch = secondaFaseCalendar.matchdays[0]!.matches[0]!;
  console.log(
    `Coppa Seconda Fase (ultima giornata): ${secondaFaseMatch.homeTeamName} ${secondaFaseMatch.homeGoals}-${secondaFaseMatch.awayGoals} ${secondaFaseMatch.awayTeamName}`,
  );
  const finalMatch = faseFinaleCalendar.matchdays[0]!.matches[0]!;
  console.log(`Fase Finale: ${finalMatch.homeTeamName} ${finalMatch.homeGoals}-${finalMatch.awayGoals} ${finalMatch.awayTeamName}`);
  console.log(`Rosa: ${roster.entries.length} righe, ${rosterFiles.length} squadre`);
  console.log(
    `Formazioni: ${lineups.length} giornate lette (${lineups[0]?.matchdayNumber}-${lineups[lineups.length - 1]?.matchdayNumber})`,
  );

  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);
  const teamNames = new Set(roster.entries.map((e) => e.teamName.trim()));

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
  await ensureCompetitions(client, seasonId, {
    coppa: {
      gironeA: { folder: COPPA_DIR },
      gironeB: { folder: COPPA_DIR },
      secondaFase: { folder: COPPA_DIR },
      faseFinale: { folder: COPPA_DIR },
    },
  });

  await repo.upsertTeams(CONFIRMED_TEAM_MERGES.map((m) => ({ name: m.canonicalName, aliases: [m.seasonAlias] })));

  await seedTeamsFromNames(seasonId, teamNames, repo);
  console.log(`Seed squadre: ${teamNames.size} squadre`);

  const playerNames = new Set(roster.entries.map((e) => e.playerName.trim()));
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
  await repo.upsertStandings(campionatoStandings);
  await repo.upsertStandings(gironeAStandings);
  await repo.upsertStandings(gironeBStandings);
  await repo.upsertStandings(secondaFaseStandings);
  await repo.upsertCalendar(campionatoCalendar);
  await repo.upsertCalendar(secondaFaseCalendar);
  await repo.upsertCalendar(faseFinaleCalendar);

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
