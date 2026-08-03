//
// Import dedicato per la stagione 2013-14: fonte XHTML server-rendered del
// mirror Leghe Fantagazzetta, con markup diverso dagli adapter flat condivisi.
//
// Dati verificabili nel dump locale:
//   - Fase finale Coppa Lelle: calendario di 5 giornate, rose aggregate e
//     formazioni complete.
//   - classifica.html: solo selettori/menu competizione, nessuna riga squadra
//     importabile; non si calcola una classifica dal calendario. Il dump non
//     contiene affatto un Campionato (il menu competizioni della lega elenca
//     solo Coppa Lelle quell'anno): calendario/formazioni di Campionato non
//     esistono, non sono un buco di parsing.
//   - Podio Campionato: nessuna classifica nella fonte HTML, ma una nota
//     storica testuale (fornita dall'utente, non verificabile da un file
//     della lega) conferma le prime 3 posizioni finali — vedi
//     CAMPIONATO_PODIUM_STANDINGS. Solo la posizione 1 riporta i punti; per le
//     posizioni 2-3 punti e fantapunti non sono noti e restano null: non si
//     inventa un dato assente in una fonte comunque parziale.
//   - Bonus nelle formazioni: la fonte HTML di questa stagione riporta le icone
//     bonus/malus direttamente nello stesso file delle formazioni Coppa Fase
//     Finale (come Campionato 2017-18/2025-26) — è una fonte diretta, non una
//     derivazione. Persistiti su `player_matchday_bonuses` con matchday_id
//     della giornata di Coppa Fase Finale stessa: matchday_bonus_sources non
//     serve, perché non c'è nessuna giornata Campionato da cui derivare (la
//     UI (`formazioni.ts`) già ricade su matchdayId quando manca un mapping in
//     matchday_bonus_sources, quindi legge questi bonus senza altre modifiche).
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-season-2013-14.ts [--dry-run]
//
// --dry-run esegue gli adapter e tutte le verifiche locali senza collegarsi a
// Supabase. L'import reale si ferma sulle squadre non risolte nel registro:
// aggiungere qui solo corrispondenze confermate dall'utente, poi rilanciare.
import { readFile, readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Html2013BonusAdapter } from '../adapters/html-legacy/2013-14/bonus.js';
import { Html2013CalendarAdapter } from '../adapters/html-legacy/2013-14/calendar.js';
import { Html2013LineupAdapter } from '../adapters/html-legacy/2013-14/lineup.js';
import { Html2013RosterAdapter } from '../adapters/html-legacy/2013-14/roster.js';
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

const DOCS_ROOT = fileURLToPath(new URL('../../../docs/Fantacalcio 2013-2014', import.meta.url));
const SOURCE_DIR = path.join(DOCS_ROOT, 'leghe.fantagazzetta.com', 'lega-fantato-pa-10th-edition');
const TEAM_LIST_FILE = path.join(SOURCE_DIR, 'squadre.html');
const BRANDING_DIR = path.join(path.dirname(SOURCE_DIR), 'idl');
const LOGOS_DIR = path.join(BRANDING_DIR, 'loghi');
const JERSEYS_DIR = path.join(BRANDING_DIR, 'magliette');

const SEASON = {
  slug: '2013-14',
  label: 'Stagione 2013/2014',
  startsOn: '2013-08-01',
  endsOn: '2014-06-30',
};

// Da compilare solo con conferme già ricevute: il parser non decide mai da
// solo se un nome storico è un alias o una nuova identità.
const CONFIRMED_TEAM_MERGES: { canonicalName: string; seasonAlias: string }[] = [
  { canonicalName: 'Carloparola Fc', seasonAlias: 'CarloParola F.C' },
  { canonicalName: 'Nemesis FC', seasonAlias: 'Nemesis 08 F.C' },
  { canonicalName: 'Prozalpi S.F.', seasonAlias: 'ProZalpi S.F.' },
  { canonicalName: 'Real Cocu 2003 Fc', seasonAlias: 'Real Cocu 2003 F.C.' },
  { canonicalName: 'MR EKO - C&W F.C.', seasonAlias: 'Skajahnny f.c 2004' },
  { canonicalName: 'FC Steaua Ste', seasonAlias: 'Steaua Ste' },
  { canonicalName: 'Uber Alles Fussball Club', seasonAlias: 'Uber Alles F.C' },
];
const CONFIRMED_NEW_TEAMS: string[] = ['Goliardic F.C.', 'pierpaologranata'];

// Nota storica utente (non presente in alcun file del mirror, il Campionato
// 2013-14 non ha una classifica.html popolata): "La stagione 2013/14 [...] la
// Carloparola, ottiene il record concludendo il campionato a 82 punti. Alle
// spalle della Carloparola si piazzano la rediviva Nemesis 08 e la
// neopromossa Uber Alles." Solo il vincitore riporta un punteggio; 2°/3°
// posto restano senza punti/fantapunti, mai inventati.
const CAMPIONATO_PODIUM_STANDINGS: StandingsImport['rows'] = [
  { teamName: 'CarloParola F.C', position: 1, points: 82 },
  { teamName: 'Nemesis 08 F.C', position: 2 },
  { teamName: 'Uber Alles F.C', position: 3 },
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

async function seedBranding2013_14(client: IngestionClient, seasonId: string): Promise<void> {
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

async function discoverCanonicalLineups(): Promise<ParsedSource[]> {
  const names = (await readdir(SOURCE_DIR))
    .filter((name) => name.startsWith('formazioni') && name.endsWith('.html'))
    .sort();
  if (names.length === 0) throw new Error(`Nessun file formazioni*.html trovato in ${SOURCE_DIR}`);

  const lineupAdapter = new Html2013LineupAdapter(SEASON.slug, 'coppa-fase-finale');
  const bonusAdapter = new Html2013BonusAdapter(SEASON.slug, 'coppa-fase-finale');
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
  if (result.length !== 5 || result.some((source, index) => source.lineup.matchdayNumber !== index + 1)) {
    throw new Error(`Attese le giornate 1-5, trovate: ${result.map((source) => source.lineup.matchdayNumber).join(', ')}`);
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

  const calendar = await new Html2013CalendarAdapter(SEASON.slug, 'coppa-fase-finale').parse(calendarFile);
  const roster = await new Html2013RosterAdapter(SEASON.slug, TEAM_LIST_FILE).parse(rosterFile);
  const sources = await discoverCanonicalLineups();
  validateCalendarAndLineups(calendar, sources);

  const teamNames = collectTeamNames(roster, calendar, sources);
  const bonusEvents = sources.reduce(
    (total, source) => total + source.bonuses.players.reduce((count, player) => count + player.bonusCodes.length, 0),
    0,
  );

  console.log('Classifica: nessuna riga squadra verificabile in classifica.html; podio Campionato importato da nota storica manuale (1°-3°), resto della classifica non disponibile.');
  console.log(`Calendario Coppa Fase Finale: ${calendar.matchdays.length} giornate, ${calendar.matchdays.reduce((total, matchday) => total + matchday.matches.length, 0)} partite`);
  console.log(`Rosa: ${roster.entries.length} righe, ${new Set(roster.entries.map((entry) => entry.teamName)).size} squadre`);
  console.log(`Formazioni: ${sources.length} giornate, ${sources.reduce((total, source) => total + source.lineup.matches.length, 0)} partite`);
  console.log(`Bonus verificati: ${bonusEvents} eventi, fonte diretta Coppa Fase Finale (nessuna giornata Campionato da cui derivare).`);
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
  await ensureCompetitions(client, seasonId, { coppa: { faseFinale: { folder: SOURCE_DIR } } });

  await repo.upsertTeams(CONFIRMED_TEAM_MERGES.map((merge) => ({ name: merge.canonicalName, aliases: [merge.seasonAlias] })));
  await repo.upsertTeams(CONFIRMED_NEW_TEAMS.map((name) => ({ name })));
  await seedTeamsFromNames(seasonId, teamNames, repo);
  await seedBranding2013_14(client, seasonId);
  console.log(`Seed squadre: ${teamNames.size}`);

  const playerNames = new Set(roster.entries.map((entry) => entry.playerName.trim()));
  for (const source of sources) {
    for (const player of source.bonuses.players) playerNames.add(player.playerName.trim());
  }
  await repo.upsertPlayers([...playerNames].map((name) => ({ name })));
  console.log(`Seed giocatori: ${playerNames.size}`);

  await repo.upsertRoster(roster);
  await repo.upsertCalendar(calendar);
  for (const source of sources) await repo.upsertLineup(source.lineup);
  for (const source of sources) await repo.upsertMatchdayBonuses(source.bonuses);
  console.log(`Bonus/malus persistiti: ${sources.length} giornate.`);
  await repo.upsertStandings({
    seasonSlug: SEASON.slug,
    competitionSlug: 'campionato',
    rows: CAMPIONATO_PODIUM_STANDINGS,
  });
  console.log('Podio Campionato importato da nota storica manuale: 1° CarloParola F.C, 2° Nemesis 08 F.C, 3° Uber Alles F.C.');

  console.log(`\nImport ${SEASON.slug} completato: Coppa Fase Finale, ${sources.length} giornate di formazioni.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error(`Import ${SEASON.slug} fallito:`, err);
    process.exit(1);
  });
}