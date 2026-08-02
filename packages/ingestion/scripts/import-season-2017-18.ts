// packages/ingestion/scripts/import-season-2017-18.ts
//
// Import dedicato per la stagione 2017-18: fonte HTML legacy "mirror flat"
// (una pagina statica per sezione, niente blob JS da decodificare — diverso
// dal mirror ricorsivo del 2018-19, vedi memoria repo
// legacy-seasons-compat.md). Script one-off per QUESTA stagione: non
// generalizzare finché non esiste una seconda stagione con la stessa
// struttura flat (skill ponytail — niente astrazioni non richieste).
//
// Dati disponibili:
//   - Campionato: classifica (9 colonne), calendario (38 giornate, 152
//     partite), rosa (8 file dettaglio-rosa/, uno per squadra), FORMAZIONI
//     (38 file formazioni-N.html — unica stagione HTML legacy con questo
//     dato; il numero N nel nome file NON è la giornata reale, va sempre
//     letta da "gselected" dentro il file, vedi lineup.ts).
//   - Coppa Girone A/B: classifica soltanto (3 colonne: pos/pt./g.), un
//     vero girone round-robin a punteggio cumulato per giornata — NESSUN
//     calendario/incontri 1-a-1 nella fonte (gap accettato, stesso pattern
//     già noto per Girone A/B 2018-19: solo upsertStandings).
//   - Coppa Seconda Fase: classifica (6 colonne, include won/drawn/lost) +
//     widget "ULTIMA GIORNATA" con l'unico incontro diretto disponibile
//     (snapshot parziale, non lo storico completo — stesso pattern già
//     accettato per Girone B 2018-19 con 5/28 giornate).
//   - Coppa Fase Finale: SOLO il widget "ULTIMA GIORNATA" (1 partita secca,
//     eliminazione diretta), nessuna classifica nella fonte.
//   - Branding: nessuna cartella "Loghi & Maglie" per questa stagione (gap
//     accettato, verificato via list_dir — a differenza del 2018-19 che
//     aveva PNG reali nel mirror).
//
// Uso (env var SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY richieste, tranne
// che in --dry-run):
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-season-2017-18.ts [--dry-run]
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const DOCS_ROOT = fileURLToPath(new URL('../../../docs/Fantacalcio 2017-2018', import.meta.url));
const CAMPIONATO_DIR = path.join(DOCS_ROOT, 'Campionato');
const ROSTER_DIR = path.join(CAMPIONATO_DIR, 'dettaglio-rosa');
const COPPA_DIR = path.join(DOCS_ROOT, 'Coppa');

const SEASON = {
  slug: '2017-18',
  label: 'Stagione 2017/2018',
  startsOn: '2017-08-01',
  endsOn: '2018-06-30',
};

// Delle 4 squadre 2017-18 non riconosciute dal registro esistente, l'utente
// ha confermato queste 3 corrispondenze (stessa identità/manager, nome
// diverso in quella stagione) — "Uber Alles Fussball Club" è confermata
// come squadra a sé, creata come nuova.
const CONFIRMED_TEAM_MERGES: { canonicalName: string; seasonAlias: string }[] = [
  { canonicalName: 'MR EKO - C&W F.C.', seasonAlias: 'BBSATLPR Bologna AC 17' },
  { canonicalName: 'Nemesis FC', seasonAlias: 'Nemesis 08 FC' },
  { canonicalName: 'Panothinaikos', seasonAlias: 'Panothinaikos 2014' },
];

async function discoverRosterFiles(): Promise<string[]> {
  const teamDirs = await readdir(ROSTER_DIR, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of teamDirs) {
    if (!entry.isDirectory()) continue;
    const teamDir = path.join(ROSTER_DIR, entry.name);
    const teamFiles = (await readdir(teamDir)).filter((name) => name.endsWith('.html'));
    if (teamFiles.length !== 1) {
      throw new Error(`Attesi esattamente 1 file .html in ${teamDir}, trovati ${teamFiles.length}`);
    }
    files.push(path.join(teamDir, teamFiles[0]!));
  }
  return files;
}

async function discoverLineupFiles(): Promise<string[]> {
  const names = (await readdir(CAMPIONATO_DIR)).filter((name) => /^formazioni-\d+\.html$/.test(name));
  if (names.length === 0) throw new Error(`Nessun file formazioni-N.html trovato in ${CAMPIONATO_DIR}`);
  return names.map((name) => path.join(CAMPIONATO_DIR, name));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const campionatoStandingsFile = path.join(CAMPIONATO_DIR, 'classifica.html');
  const campionatoCalendarFile = path.join(CAMPIONATO_DIR, 'calendario.html');
  const gironeAStandingsFile = path.join(COPPA_DIR, 'Girone A.html');
  const gironeBStandingsFile = path.join(COPPA_DIR, 'Girone B.html');
  const secondaFaseStandingsFile = path.join(COPPA_DIR, 'Seconda fase.html');
  const faseFinaleFile = path.join(COPPA_DIR, 'Fase finale.html');

  const campionatoStandings = await new FlatHtmlStandingsAdapter(SEASON.slug, 'campionato').parse(
    campionatoStandingsFile,
  );
  const campionatoCalendar = await new FlatHtmlCalendarAdapter(SEASON.slug, 'campionato').parse(
    campionatoCalendarFile,
  );
  const gironeAStandings = await new FlatHtmlStandingsAdapter(SEASON.slug, 'coppa-girone-a').parse(
    gironeAStandingsFile,
  );
  const gironeBStandings = await new FlatHtmlStandingsAdapter(SEASON.slug, 'coppa-girone-b').parse(
    gironeBStandingsFile,
  );
  const secondaFaseStandings = await new FlatHtmlStandingsAdapter(SEASON.slug, 'coppa-seconda-fase').parse(
    secondaFaseStandingsFile,
  );
  const secondaFaseCalendar = await new FlatHtmlFinalMatchAdapter(SEASON.slug, 'coppa-seconda-fase').parse(
    secondaFaseStandingsFile,
  );
  const faseFinaleCalendar = await new FlatHtmlFinalMatchAdapter(SEASON.slug, 'coppa-fase-finale').parse(
    faseFinaleFile,
  );

  const rosterFiles = await discoverRosterFiles();
  const roster = await new FlatHtmlRosterAdapter(SEASON.slug).parse(rosterFiles);

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
  console.log(
    `Fase Finale: ${finalMatch.homeTeamName} ${finalMatch.homeGoals}-${finalMatch.awayGoals} ${finalMatch.awayTeamName}`,
  );
  console.log(`Rosa: ${roster.entries.length} righe, ${rosterFiles.length} squadre`);
  console.log(`Formazioni: ${lineups.length} giornate lette (${lineups[0]?.matchdayNumber}-${lineups[lineups.length - 1]?.matchdayNumber})`);

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

  // Registra gli alias confermati PRIMA della risoluzione squadre, così
  // seedTeamsFromNames trova già l'identità corretta invece di crearne una
  // nuova per errore.
  await repo.upsertTeams(CONFIRMED_TEAM_MERGES.map((m) => ({ name: m.canonicalName, aliases: [m.seasonAlias] })));

  await seedTeamsFromNames(seasonId, teamNames, repo);
  console.log(`Seed squadre: ${teamNames.size} squadre`);

  const playerNames = new Set(roster.entries.map((e) => e.playerName.trim()));
  // Le formazioni possono contenere giocatori assenti dalla rosa d'asta
  // iniziale (mercato in corso di stagione) — bug reale al primo import
  // ("Krejci non trovato"): unire sempre i nomi da entrambe le fonti prima
  // di seminare i giocatori, non fidarsi della sola rosa d'asta.
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

main().catch((err: unknown) => {
  console.error(`Import ${SEASON.slug} fallito:`, err);
  process.exit(1);
});
