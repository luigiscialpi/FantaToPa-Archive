//
// Import dedicato per la stagione 2012-13: fonte XHTML server-rendered dello
// stesso mirror Leghe Fantagazzetta già usato per il 2013-14 (stessa cartella
// "lega-fantato-pa-10th-edition"), ma qui il dump contiene il Campionato
// completo (38 giornate), non solo la Fase Finale di Coppa.
//
// Dati verificabili nel dump locale:
//   - classifica.html: classifica reale completa (Pt./G/V/N/P/G+/G-/Somma Pt.),
//     tutte e 10 le squadre, 38 giornate giocate — nuovo
//     Html2013StandingsAdapter (il 2013-14 non ne aveva bisogno, la sua
//     classifica.html era vuota).
//   - calendario.html: 38 giornate, stesso markup del 2013-14 (adapter
//     invariato).
//   - formazioni*.html: come nel 2013-14, più copie duplicate per alcune
//     giornate (HTTrack ha scaricato lo stesso URL più volte); dedup per
//     contenuto identico, stesso meccanismo di discoverCanonicalLineups già
//     usato per il 2013-14, generalizzato da 5 a N giornate.
//   - Bonus/malus: presenti, ma con un marcatore diverso dalla Coppa Fase
//     Finale 2013-14/2017-18/2025-26 (niente `class="ico"`, un controllo
//     iniziale basato su quella classe aveva erroneamente concluso che
//     mancassero) — qui sono semplici `<img alt="Ammonito">` ecc. dentro
//     `<td class="player">`, lo stesso formato già gestito da
//     Html2013BonusAdapter (icone diverse solo nel file sorgente, non nel
//     markup). Fonte diretta sulla giornata di Campionato stessa (come nel
//     caso 2013-14), nessuna matchday_bonus_sources da derivare.
//   - Nessuna Coppa Lelle in questo dump (nessuna menzione "coppa"/"lelle" in
//     statistiche.html): coerente con l'anno prima dell'edizione manuale già
//     importata da import-historical-seasons.ts (2012-13 vi crea solo
//     coppa-fase-finale con il vincitore, dato manuale non toccato da questo
//     script).
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-season-2012-13.ts [--dry-run]
//
// --dry-run esegue gli adapter e tutte le verifiche locali senza collegarsi a
// Supabase.
import { readFile, readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Html2013BonusAdapter } from '../adapters/html-legacy/2013-14/bonus.js';
import { Html2013CalendarAdapter } from '../adapters/html-legacy/2013-14/calendar.js';
import { Html2013LineupAdapter } from '../adapters/html-legacy/2013-14/lineup.js';
import { Html2013RosterAdapter } from '../adapters/html-legacy/2013-14/roster.js';
import { Html2013StandingsAdapter } from '../adapters/html-legacy/2013-14/standings.js';
import { createIngestionClient } from '../lib/supabase-client.js';
import { normalizeName } from '../lib/normalize-name.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import type { BonusImport, CalendarImport, LineupImport, RosterImport, StandingsImport } from '../schema/imports.js';
import {
  buildTeamBrandingLookup,
  ensureCompetitions,
  ensureLookups,
  ensureSeason,
  seedTeamsFromNames,
  uploadBrandingAsset,
} from './import-season.js';

const DOCS_ROOT = fileURLToPath(new URL('../../../docs/Fantacalcio 2012-2013', import.meta.url));
const SOURCE_DIR = path.join(DOCS_ROOT, 'Fantacalcio 2012_13', 'leghe.fantagazzetta.com', 'lega-fantato-pa-10th-edition');
const TEAM_LIST_FILE = path.join(SOURCE_DIR, 'squadre.html');
const BRANDING_DIR = path.join(path.dirname(SOURCE_DIR), 'idl');
const LOGOS_DIR = path.join(BRANDING_DIR, 'loghi');
const JERSEYS_DIR = path.join(BRANDING_DIR, 'magliette');

const SEASON = {
  slug: '2012-13',
  label: 'Stagione 2012/2013',
  startsOn: '2012-08-01',
  endsOn: '2013-06-30',
};

// Solo le identità NON già risolvibili dagli alias esistenti in DB:
//   - "C. F. Igli Tare 2003" = Biancoceleste Athletic Club, confermato
//     esplicitamente dall'utente (nome mai visto in nessun'altra stagione).
//   - "Sjajahnny f.c 2004" = MR EKO - C&W F.C., typo del dump presente SOLO
//     nel file formazioni della giornata 1 (formazioni509a.html, verificato
//     con grep su tutto il dump) — variante non elencata fra quelle note in
//     import-historical-seasons.ts (Skajahnni/Skajahnny/Skajanny), ma stesso
//     campionato/stessa giornata/stesso contesto della grafia corretta
//     "Skajahnny f.c 2004" (già alias registrato altrove), quindi stessa
//     squadra, non una nuova.
// Le altre 6 squadre di questa stagione hanno un alias già registrato da
// import precedenti (2013-14/import-historical-seasons.ts): CarloParola F.C,
// Nemesis 08 F.C, ProZalpi S.F., Real Cocu 2003 F.C., Skajahnny f.c 2004,
// Steaua Ste, AC Smokingbiancoleite — seedTeamsFromNames le risolve da sole
// via team_aliases già in DB, non serve ripeterle qui. "Goliardic F.C." e
// "pierpaologranata" sono già canonical_name esistenti (match esatto), non
// alias.
const CONFIRMED_TEAM_MERGES: { canonicalName: string; seasonAlias: string }[] = [
  { canonicalName: 'Biancoceleste Athletic Club', seasonAlias: 'C. F. Igli Tare 2003' },
  { canonicalName: 'MR EKO - C&W F.C.', seasonAlias: 'Sjajahnny f.c 2004' },
];

type ParsedSource = {
  filePath: string;
  lineup: LineupImport;
  bonuses: BonusImport;
};

type IngestionClient = ReturnType<typeof createIngestionClient>;

function parseBrandingTeamIds(html: string): Map<string, string> {
  const teamNamesById = new Map<string, string>();
  const logoPattern = /<img\s+src="\.\.\/idl\/loghi\/(\d+)\.jpg"\s+alt="([^"]+)"/g;

  for (const match of html.matchAll(logoPattern)) {
    const teamId = match[1];
    const teamName = match[2]?.trim();
    if (teamId && teamName) teamNamesById.set(teamId, teamName);
  }

  if (teamNamesById.size === 0) throw new Error(`Nessun branding personalizzato trovato in ${TEAM_LIST_FILE}`);
  return teamNamesById;
}

async function seedBranding2012_13(client: IngestionClient, seasonId: string): Promise<void> {
  const teamNamesById = parseBrandingTeamIds(await readFile(TEAM_LIST_FILE, 'utf8'));
  const lookup = await buildTeamBrandingLookup(client);
  const [logoEntries, jerseyEntries] = await Promise.all([readdir(LOGOS_DIR), readdir(JERSEYS_DIR)]);
  let logoCount = 0;
  let jerseyCount = 0;

  for (const [teamId, teamName] of teamNamesById) {
    const team = lookup.get(normalizeName(teamName));
    if (!team) throw new Error(`Nessuna squadra DB risolta per il branding di "${teamName}"`);

    const logoFile = logoEntries.find((name) => name.toLowerCase() === `${teamId}.jpg`);
    const jerseyFile = jerseyEntries.find(
      (name) => name.toLowerCase().startsWith(teamId) && /\.(png|jpe?g|webp)$/i.test(name),
    );

    if (logoFile) {
      await uploadBrandingAsset(client, seasonId, SEASON.slug, team, 'logo', path.join(LOGOS_DIR, logoFile));
      logoCount += 1;
    }
    if (jerseyFile) {
      await uploadBrandingAsset(client, seasonId, SEASON.slug, team, 'jersey', path.join(JERSEYS_DIR, jerseyFile));
      jerseyCount += 1;
    }
  }

  console.log(`Branding: ${logoCount} loghi e ${jerseyCount} maglie personalizzati caricati; placeholder saltati.`);
}

function isPreferredDuplicate(candidate: string, current: string): boolean {
  const candidateName = path.basename(candidate);
  const currentName = path.basename(current);
  if (candidateName === 'formazioni.html') return true;
  if (currentName === 'formazioni.html') return false;
  return candidateName < currentName;
}

// Stesso meccanismo di dedup del 2013-14 (discoverCanonicalLineups),
// generalizzato: qui non sappiamo a priori quante copie per giornata (il
// dump ne ha di più, 77 file per 38 giornate contro 6 per 5), quindi si
// valida solo che il risultato finale copra 1..N senza buchi né doppioni
// discordanti.
async function discoverCanonicalLineups(): Promise<ParsedSource[]> {
  const names = (await readdir(SOURCE_DIR))
    .filter((name) => name.startsWith('formazioni') && name.endsWith('.html'))
    .sort();
  if (names.length === 0) throw new Error(`Nessun file formazioni*.html trovato in ${SOURCE_DIR}`);

  const lineupAdapter = new Html2013LineupAdapter(SEASON.slug, 'campionato');
  const bonusAdapter = new Html2013BonusAdapter(SEASON.slug, 'campionato');
  const byMatchday = new Map<number, ParsedSource>();

  for (const name of names) {
    const filePath = path.join(SOURCE_DIR, name);
    const candidate: ParsedSource = {
      filePath,
      lineup: await lineupAdapter.parse(filePath),
      bonuses: await bonusAdapter.parse(filePath),
    };
    const current = byMatchday.get(candidate.lineup.matchdayNumber);
    if (!current) {
      byMatchday.set(candidate.lineup.matchdayNumber, candidate);
      continue;
    }

    if (JSON.stringify(current.lineup) !== JSON.stringify(candidate.lineup)) {
      throw new Error(`Copie discordanti per la giornata ${candidate.lineup.matchdayNumber}: ${current.filePath} e ${filePath}`);
    }
    if (JSON.stringify(current.bonuses) !== JSON.stringify(candidate.bonuses)) {
      throw new Error(`Bonus discordanti per la giornata ${candidate.lineup.matchdayNumber}: ${current.filePath} e ${filePath}`);
    }

    const preferred = isPreferredDuplicate(filePath, current.filePath) ? candidate : current;
    console.warn(
      `Copia duplicata ignorata per la giornata ${candidate.lineup.matchdayNumber}: ${path.basename(
        preferred === candidate ? current.filePath : filePath,
      )}`,
    );
    byMatchday.set(candidate.lineup.matchdayNumber, preferred);
  }

  const result = [...byMatchday.values()].sort((left, right) => left.lineup.matchdayNumber - right.lineup.matchdayNumber);
  if (result.length !== 38 || result.some((source, index) => source.lineup.matchdayNumber !== index + 1)) {
    throw new Error(`Attese le giornate 1-38, trovate: ${result.map((source) => source.lineup.matchdayNumber).join(', ')}`);
  }
  return result;
}

function collectTeamNames(roster: RosterImport, calendar: CalendarImport, standings: StandingsImport, sources: ParsedSource[]): Set<string> {
  const names = new Set<string>();
  for (const entry of roster.entries) names.add(entry.teamName.trim());
  for (const row of standings.rows) names.add(row.teamName.trim());
  for (const matchday of calendar.matchdays) {
    for (const match of matchday.matches) {
      names.add(match.homeTeamName.trim());
      names.add(match.awayTeamName.trim());
    }
  }
  for (const source of sources) {
    for (const match of source.lineup.matches) {
      names.add(match.home.teamName.trim());
      if (match.away) names.add(match.away.teamName.trim());
    }
  }
  return names;
}

function validateCalendarAndLineups(calendar: CalendarImport, sources: ParsedSource[]): void {
  if (calendar.matchdays.length !== sources.length) {
    throw new Error(`Calendario e formazioni hanno un numero diverso di giornate: ${calendar.matchdays.length} vs ${sources.length}`);
  }
  for (const source of sources) {
    const calendarMatchday = calendar.matchdays.find((matchday) => matchday.number === source.lineup.matchdayNumber);
    if (!calendarMatchday || calendarMatchday.matches.length !== source.lineup.matches.length) {
      throw new Error(
        `Calendario/formazioni discordanti alla giornata ${source.lineup.matchdayNumber}: ${calendarMatchday?.matches.length ?? 0} vs ${source.lineup.matches.length}`,
      );
    }
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const calendarFile = path.join(SOURCE_DIR, 'calendario.html');
  const classificaFile = path.join(SOURCE_DIR, 'classifica.html');
  const rosterFile = path.join(SOURCE_DIR, 'tutte-le-rose.html');

  const calendar = await new Html2013CalendarAdapter(SEASON.slug, 'campionato').parse(calendarFile);
  const standings = await new Html2013StandingsAdapter(SEASON.slug, 'campionato').parse(classificaFile);
  const roster = await new Html2013RosterAdapter(SEASON.slug, TEAM_LIST_FILE).parse(rosterFile);
  const sources = await discoverCanonicalLineups();
  validateCalendarAndLineups(calendar, sources);

  const teamNames = collectTeamNames(roster, calendar, standings, sources);
  const bonusEvents = sources.reduce(
    (total, source) => total + source.bonuses.players.reduce((count, player) => count + player.bonusCodes.length, 0),
    0,
  );

  console.log(`Classifica: ${standings.rows.length} righe`);
  console.log(`Calendario Campionato: ${calendar.matchdays.length} giornate, ${calendar.matchdays.reduce((total, matchday) => total + matchday.matches.length, 0)} partite`);
  console.log(`Rosa: ${roster.entries.length} righe, ${new Set(roster.entries.map((entry) => entry.teamName)).size} squadre`);
  console.log(`Formazioni: ${sources.length} giornate, ${sources.reduce((total, source) => total + source.lineup.matches.length, 0)} partite`);
  console.log(`Bonus verificati: ${bonusEvents} eventi, fonte diretta Campionato (nessuna derivazione).`);
  console.log(`Squadre coinvolte: ${teamNames.size}`);

  if (dryRun) {
    console.log('\n--dry-run: adapter eseguiti, nessuna scrittura su Supabase e nessuna risoluzione remota delle identita.');
    for (const name of [...teamNames].sort()) console.log(`  - ${name}`);
    return;
  }

  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);
  const seasonId = await ensureSeason(client, SEASON);
  await ensureLookups(client);
  await ensureCompetitions(client, seasonId, {});

  await repo.upsertTeams(CONFIRMED_TEAM_MERGES.map((merge) => ({ name: merge.canonicalName, aliases: [merge.seasonAlias] })));
  await seedTeamsFromNames(seasonId, teamNames, repo);
  await seedBranding2012_13(client, seasonId);
  console.log(`Seed squadre: ${teamNames.size}`);

  const playerNames = new Set(roster.entries.map((entry) => entry.playerName.trim()));
  for (const source of sources) {
    for (const match of source.lineup.matches) {
      for (const player of match.home.players) playerNames.add(player.playerName.trim());
      if (match.away) for (const player of match.away.players) playerNames.add(player.playerName.trim());
    }
  }
  await repo.upsertPlayers([...playerNames].map((name) => ({ name })));
  console.log(`Seed giocatori: ${playerNames.size}`);

  await repo.upsertRoster(roster);
  await repo.upsertCalendar(calendar);
  for (const source of sources) await repo.upsertLineup(source.lineup);
  for (const source of sources) await repo.upsertMatchdayBonuses(source.bonuses);
  console.log(`Bonus/malus persistiti: ${sources.length} giornate.`);
  await repo.upsertStandings(standings);
  console.log('Classifica Campionato persistita.');

  console.log(`\nImport ${SEASON.slug} completato: Campionato, ${sources.length} giornate di formazioni.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error(`Import ${SEASON.slug} fallito:`, err);
    process.exit(1);
  });
}
