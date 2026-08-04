//
// Import dedicato per la stagione 2011-12: fonte HTML legacy del mirror
// Leghe Fantagazzetta (markup ibrido: giornate 1 e 10-38 come 2013-14,
// giornate 2-9 con header squadra nel <thead> e solo colonna Voto).
//
// Dati importati:
//   - Campionato: classifica, calendario, rose (con crediti residui),
//     formazioni e bonus/malus dalle icone nelle formazioni.
//   - Branding: loghi e maglie da idl/loghi/ e idl/magliette/.
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-season-2011-12.ts [--dry-run]
//
// --dry-run esegue gli adapter e le verifiche locali senza collegarsi a
// Supabase. L'import reale si ferma sulle squadre non risolte nel registro:
// aggiungere qui solo corrispondenze confermate dall'utente, poi rilanciare.
import { readFile, readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Html2011BonusAdapter } from '../adapters/html-legacy/2011-12/bonus.js';
import { Html2011CalendarAdapter } from '../adapters/html-legacy/2011-12/calendar.js';
import { Html2011LineupAdapter } from '../adapters/html-legacy/2011-12/lineup.js';
import { Html2011RosterAdapter } from '../adapters/html-legacy/2011-12/roster.js';
import { Html2011StandingsAdapter } from '../adapters/html-legacy/2011-12/standings.js';
import { createIngestionClient } from '../lib/supabase-client.js';
import { normalizeName } from '../lib/normalize-name.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import type { BonusImport, CalendarImport, LineupImport, RosterImport } from '../schema/imports.js';
import {
  buildTeamBrandingLookup,
  ensureCompetitions,
  ensureLookups,
  ensureSeason,
  seedTeamsFromNames,
  uploadBrandingAsset,
} from './import-season.js';

const DOCS_ROOT = fileURLToPath(new URL('../../../docs/Fantacalcio 2011-2012', import.meta.url));
const SOURCE_DIR = path.join(DOCS_ROOT, 'Fantacalcio 2011-12', 'leghe.fantagazzetta.com', 'fanta-t-o-p-a');
const TEAM_LIST_FILE = path.join(SOURCE_DIR, 'squadre.html');
const BRANDING_DIR = path.join(path.dirname(SOURCE_DIR), 'idl');
const LOGOS_DIR = path.join(BRANDING_DIR, 'loghi');
const JERSEYS_DIR = path.join(BRANDING_DIR, 'magliette');

const SEASON = {
  slug: '2011-12',
  label: 'Stagione 2011/2012',
  startsOn: '2011-08-01',
  endsOn: '2012-06-30',
};

// Alias confermati: nomi usati nella stagione 2011-12 che corrispondono a
// squadre già presenti nel registro con un canonical name diverso.
const CONFIRMED_TEAM_MERGES: { canonicalName: string; seasonAlias: string }[] = [
  { canonicalName: 'Goliardic F.C.', seasonAlias: 'Goliardic FC' },
  { canonicalName: 'Carloparola Fc', seasonAlias: 'CarloParola f.c.' },
  { canonicalName: 'Nemesis FC', seasonAlias: 'Nemesis 08 F.C.' },
  { canonicalName: 'Prozalpi S.F.', seasonAlias: 'ProZalpi S.F.' },
  { canonicalName: 'Real Cocu 2003 Fc', seasonAlias: 'Real Cocu 2003 F.C.' },
  { canonicalName: 'MR EKO - C&W F.C.', seasonAlias: 'Skajahnni F.C' },
  { canonicalName: 'FC Steaua Ste', seasonAlias: 'Steaua Ste 2003' },
];

// Squadre nuove rispetto al registro esistente.
const CONFIRMED_NEW_TEAMS: string[] = ['C. F. Igli Tare 2003', 'A.C. SmokingBiancoLeite'];

type ParsedSource = {
  filePath: string;
  lineup: LineupImport;
  bonuses: BonusImport;
};

type IngestionClient = ReturnType<typeof createIngestionClient>;

function parseBrandingTeamIds(html: string): Map<string, string> {
  const teamNamesById = new Map<string, string>();
  const logoPattern = /<img\s+src="\.\.\/idl\/loghi\/(\d+)\.[^"]+"\s+alt="([^"]+)"/g;

  for (const match of html.matchAll(logoPattern)) {
    const teamId = match[1];
    const teamName = match[2]?.trim();
    if (teamId && teamName) teamNamesById.set(teamId, teamName);
  }

  if (teamNamesById.size === 0) throw new Error(`Nessun branding personalizzato trovato in ${TEAM_LIST_FILE}`);
  return teamNamesById;
}

async function seedBranding2011_12(client: IngestionClient, seasonId: string): Promise<void> {
  const teamNamesById = parseBrandingTeamIds(await readFile(TEAM_LIST_FILE, 'utf8'));
  const lookup = await buildTeamBrandingLookup(client);
  const [logoEntries, jerseyEntries] = await Promise.all([readdir(LOGOS_DIR), readdir(JERSEYS_DIR)]);
  let logoCount = 0;
  let jerseyCount = 0;

  for (const [teamId, teamName] of teamNamesById) {
    const team = lookup.get(normalizeName(teamName));
    if (!team) throw new Error(`Nessuna squadra DB risolta per il branding di "${teamName}"`);

    const logoFile = logoEntries.find((name) => name.toLowerCase().startsWith(`${teamId}.`));
    const jerseyFile = jerseyEntries.find((name) => name.toLowerCase().startsWith(teamId) && /\.(png|jpe?g|webp)$/i.test(name));

    if (logoFile) {
      await uploadBrandingAsset(client, seasonId, SEASON.slug, team, 'logo', path.join(LOGOS_DIR, logoFile));
      logoCount += 1;
    }
    if (jerseyFile) {
      await uploadBrandingAsset(client, seasonId, SEASON.slug, team, 'jersey', path.join(JERSEYS_DIR, jerseyFile));
      jerseyCount += 1;
    }
  }

  console.log(`Branding: ${logoCount} loghi e ${jerseyCount} maglie personalizzati caricati.`);
}

function isPreferredDuplicate(candidate: string, current: string): boolean {
  const candidateName = path.basename(candidate);
  const currentName = path.basename(current);
  if (candidateName === 'formazioni.html') return true;
  if (currentName === 'formazioni.html') return false;
  return candidateName < currentName;
}

async function discoverCanonicalLineups(): Promise<ParsedSource[]> {
  const names = (await readdir(SOURCE_DIR))
    .filter((name) => name.startsWith('formazioni') && name.endsWith('.html'))
    .sort();
  if (names.length === 0) throw new Error(`Nessun file formazioni*.html trovato in ${SOURCE_DIR}`);

  const lineupAdapter = new Html2011LineupAdapter(SEASON.slug, 'campionato');
  const bonusAdapter = new Html2011BonusAdapter(SEASON.slug, 'campionato');
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

function collectTeamNames(roster: RosterImport, calendar: CalendarImport, sources: ParsedSource[]): Set<string> {
  const names = new Set<string>();
  for (const entry of roster.entries) names.add(entry.teamName.trim());
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
  const rosterFile = path.join(SOURCE_DIR, 'tutte-le-rose.html');
  const standingsFile = path.join(SOURCE_DIR, 'classifica.html');

  const standings = await new Html2011StandingsAdapter(SEASON.slug, 'campionato').parse(standingsFile);
  const roster = await new Html2011RosterAdapter(SEASON.slug, TEAM_LIST_FILE).parse(rosterFile);
  const sources = await discoverCanonicalLineups();
  const calendar = await new Html2011CalendarAdapter(SEASON.slug, 'campionato').parse({ calendarFile, lineups: sources.map((s) => s.lineup) });
  validateCalendarAndLineups(calendar, sources);

  const teamNames = collectTeamNames(roster, calendar, sources);
  const bonusEvents = sources.reduce(
    (total, source) => total + source.bonuses.players.reduce((count, player) => count + player.bonusCodes.length, 0),
    0,
  );

  console.log(`Classifica: ${standings.rows.length} squadre`);
  console.log(`Calendario: ${calendar.matchdays.length} giornate, ${calendar.matchdays.reduce((total, matchday) => total + matchday.matches.length, 0)} partite`);
  console.log(`Rosa: ${roster.entries.length} righe, ${new Set(roster.entries.map((entry) => entry.teamName)).size} squadre`);
  console.log(`Formazioni: ${sources.length} giornate, ${sources.reduce((total, source) => total + source.lineup.matches.length, 0)} partite`);
  console.log(`Bonus/malus: ${bonusEvents} eventi`);
  console.log(`Squadre coinvolte: ${teamNames.size}`);

  if (dryRun) {
    console.log('\n--dry-run: adapter eseguiti, nessuna scrittura su Supabase e nessuna risoluzione remota delle identità.');
    for (const name of [...teamNames].sort()) console.log(`  - ${name}`);
    return;
  }

  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);
  const seasonId = await ensureSeason(client, SEASON);
  await ensureLookups(client);
  await ensureCompetitions(client, seasonId, { coppa: {} });

  await repo.upsertTeams(CONFIRMED_TEAM_MERGES.map((merge) => ({ name: merge.canonicalName, aliases: [merge.seasonAlias] })));
  await repo.upsertTeams(CONFIRMED_NEW_TEAMS.map((name) => ({ name })));
  await seedTeamsFromNames(seasonId, teamNames, repo);
  await seedBranding2011_12(client, seasonId);
  console.log(`Seed squadre: ${teamNames.size}`);

  const playerNames = new Set(roster.entries.map((entry) => entry.playerName.trim()));
  for (const source of sources) {
    for (const player of source.bonuses.players) playerNames.add(player.playerName.trim());
  }
  await repo.upsertPlayers([...playerNames].map((name) => ({ name })));
  console.log(`Seed giocatori: ${playerNames.size}`);

  await repo.upsertStandings(standings);
  await repo.upsertRoster(roster);
  await repo.upsertCalendar(calendar);
  for (const source of sources) await repo.upsertLineup(source.lineup);
  for (const source of sources) await repo.upsertMatchdayBonuses(source.bonuses);
  console.log(`Bonus/malus persistiti: ${sources.length} giornate.`);

  console.log(`\nImport ${SEASON.slug} completato.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error(`Import ${SEASON.slug} fallito:`, err);
    process.exit(1);
  });
}
