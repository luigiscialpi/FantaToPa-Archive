// packages/ingestion/scripts/import-season-2018-19.ts
//
// Import dedicato per la stagione 2018-19: fonte HTML legacy (mirror del
// vecchio sito "Leghe Fantagazzetta"), non xlsx — non si adatta a
// season-configs.ts/SeasonConfig (pensato per cartelle+file xlsx scoperti
// per prefisso). Script one-off per QUESTA stagione: non generalizzare ad
// altre stagioni HTML legacy finché non ne esiste una seconda con la stessa
// struttura (vedi skill ponytail — niente astrazioni non richieste).
//
// Dati disponibili (dettagli/verifica in memoria repo
// legacy-seasons-compat.md):
//   - Campionato: classifica, calendario (38 giornate), rosa d'asta.
//   - Coppa Lelle Girone A/B: classifica "Formula 1" (TIPO COMPETIZIONE: 3
//     in home.html — girone senza incontri 1-a-1, solo un punteggio
//     cumulato per giornata contro l'intero girone). Girone B via blob "ci"
//     (classifica.html, 5 giornate su 28 possibili); Girone A non ha
//     classifica.html/calendario.html propri, solo la tabella già
//     renderizzata in home.html (5 giornate su 28, "vittoria non ancora
//     determinata" — snapshot parziale, mai finalizzato dall'admin
//     dell'epoca: importato as-is, nessuna classifica finale fittizia).
//   - Coppa Lelle Fase Finale: nessun blob calendario, ma home.html
//     renderizza in HTML statico il widget "Ultima Giornata" con l'unica
//     partita che conta (la finale): Carloparola Fc 1-0 Nemesis FC. Basta
//     1 giornata + 1 partita perché getCupFinalWinners
//     (apps/web/lib/queries/home.ts) riconosca il vincitore Coppa in tutta
//     l'app (Home, Galleria, Albo d'Oro) — stessa logica già in uso per le
//     altre stagioni, nessuna modifica a schema/query.
//   - Branding: oltre al blob "lt" (solo metadata generatore), il mirror ha
//     una cartella Campionato/web/risorse/{squadra,maglietta}/ con PNG reali
//     nominati "{idSquadraNumerico}_{hash}.png" — 9/10 stemmi, 10/10
//     maglie. Risolto id numerico -> nome squadra via lo stesso blob "lt"
//     già usato per classifica/calendario/rose, poi caricato con le
//     funzioni riusate da import-season.ts (stesso bucket/path delle altre
//     stagioni).
//   - Formazioni: assenti dalla fonte per l'intera stagione (confermato
//     anche dal template Handlebars mai popolato in
//     Girone B/fantatopa/formazioni/index.htm — gap accettato con l'utente,
//     segnalato in UI da DataGapNotice).
//
// Uso (env var SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY richieste, tranne
// che in --dry-run):
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-season-2018-19.ts [--dry-run]
import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { HtmlLegacyStandingsAdapter, HtmlLegacyGroupTableStandingsAdapter } from '../adapters/html-legacy/standings.js';
import { HtmlLegacyCalendarAdapter, HtmlLegacyFinalMatchAdapter } from '../adapters/html-legacy/calendar.js';
import { HtmlLegacyRosterAdapter } from '../adapters/html-legacy/roster.js';
import { extractTeamBlobs, teamNameById } from '../adapters/html-legacy/decode.js';
import { normalizeName } from '../lib/normalize-name.js';
import {
  ensureSeason,
  ensureLookups,
  ensureCompetitions,
  seedTeamsFromNames,
  buildTeamBrandingLookup,
  uploadBrandingAsset,
} from './import-season.js';

const DOCS_ROOT = fileURLToPath(new URL('../../../docs/Fantacalcio 2018-2019', import.meta.url));
const CAMPIONATO_ROOT = path.join(DOCS_ROOT, 'Campionato');
const CAMPIONATO_DIR = path.join(CAMPIONATO_ROOT, 'fantatopa');
const CRESTS_DIR = path.join(CAMPIONATO_ROOT, 'web', 'risorse', 'squadra');
const JERSEYS_DIR = path.join(CAMPIONATO_ROOT, 'web', 'risorse', 'maglietta');
const COPPA_GIRONE_A_DIR = path.join(DOCS_ROOT, 'Coppa', 'Girone A', 'fantatopa');
const COPPA_GIRONE_B_DIR = path.join(DOCS_ROOT, 'Coppa', 'Girone B', 'fantatopa');
const COPPA_FASE_FINALE_DIR = path.join(DOCS_ROOT, 'Coppa', 'Fase finale', 'leghe.fantagazzetta.com', 'fantatopa');

const SEASON = {
  slug: '2018-19',
  label: 'Stagione 2018/2019',
  startsOn: '2018-08-01',
  endsOn: '2019-06-30',
};

// Delle 5 squadre 2018-19 non riconosciute dal registro esistente, l'utente
// ha confermato queste 2 corrispondenze (stessa identità/manager, nome
// diverso in quella stagione) — le altre 3 (Panothinaikos, Nemesis FC, FC
// Steaua Ste) sono confermate come squadre a sé, create come nuove.
const CONFIRMED_TEAM_MERGES: { canonicalName: string; seasonAlias: string }[] = [
  { canonicalName: 'Los Cientoquattros Hertha Rallo', seasonAlias: 'Ci Cangia Defrisca Football Club' },
  { canonicalName: 'Associazione Sportiva via Roma', seasonAlias: 'Manchester Iutatime' },
];

type IngestionClient = ReturnType<typeof createIngestionClient>;

// I file in Campionato/web/risorse/{squadra,maglietta}/ sono nominati
// "{idSquadraNumerico}_{hash}.png" (thumbnail con prefisso "s_" escluse
// automaticamente: non iniziano con l'id). L'id -> nome squadra viene dallo
// stesso blob "lt" già usato per classifica/calendario/rose (roster.ts),
// non da una risorsa a parte.
async function seedBranding2018_19(
  client: IngestionClient,
  seasonId: string,
  teamNamesById: Map<number, string>,
): Promise<void> {
  const lookup = await buildTeamBrandingLookup(client);
  const dirs: { dir: string; kind: 'logo' | 'jersey' }[] = [
    { dir: CRESTS_DIR, kind: 'logo' },
    { dir: JERSEYS_DIR, kind: 'jersey' },
  ];

  for (const { dir, kind } of dirs) {
    const entries = await readdir(dir);
    for (const [teamId, teamName] of teamNamesById) {
      const fileName = entries.find((name) => name.startsWith(`${teamId}_`));
      if (!fileName) continue;
      const team = lookup.get(normalizeName(teamName));
      if (!team) {
        console.warn(`  ? nessuna squadra risolta per "${teamName}" (branding ${kind})`);
        continue;
      }
      await uploadBrandingAsset(client, seasonId, SEASON.slug, team, kind, path.join(dir, fileName));
    }
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const campionatoStandingsFile = path.join(CAMPIONATO_DIR, 'classifica.html');
  const campionatoCalendarFile = path.join(CAMPIONATO_DIR, 'calendario.html');
  const campionatoRosterTableFile = path.join(CAMPIONATO_DIR, 'rose.html');
  const gironeAStandingsFile = path.join(COPPA_GIRONE_A_DIR, 'home.html');
  const gironeBStandingsFile = path.join(COPPA_GIRONE_B_DIR, 'classifica.html');
  const faseFinaleFile = path.join(COPPA_FASE_FINALE_DIR, 'home.html');

  const campionatoStandings = await new HtmlLegacyStandingsAdapter(SEASON.slug, 'campionato', 'full').parse(
    campionatoStandingsFile,
  );
  const campionatoCalendar = await new HtmlLegacyCalendarAdapter(SEASON.slug, 'campionato').parse(
    campionatoCalendarFile,
  );
  const gironeAStandings = await new HtmlLegacyGroupTableStandingsAdapter(SEASON.slug, 'coppa-girone-a').parse(
    gironeAStandingsFile,
  );
  const gironeBStandings = await new HtmlLegacyStandingsAdapter(SEASON.slug, 'coppa-girone-b', 'reduced').parse(
    gironeBStandingsFile,
  );
  const faseFinaleCalendar = await new HtmlLegacyFinalMatchAdapter(SEASON.slug, 'coppa-fase-finale').parse(
    faseFinaleFile,
  );
  const roster = await new HtmlLegacyRosterAdapter(SEASON.slug).parse({
    teamBlobFile: campionatoCalendarFile,
    playerTableFile: campionatoRosterTableFile,
  });

  console.log(`Classifica campionato: ${campionatoStandings.rows.length} squadre`);
  console.log(`Calendario campionato: ${campionatoCalendar.matchdays.length} giornate`);
  console.log(`Classifica Coppa Girone A: ${gironeAStandings.rows.length} squadre (snapshot parziale, 5/28 giornate)`);
  console.log(`Classifica Coppa Girone B: ${gironeBStandings.rows.length} squadre`);
  const finalMatch = faseFinaleCalendar.matchdays[0]!.matches[0]!;
  console.log(
    `Fase Finale: ${finalMatch.homeTeamName} ${finalMatch.homeGoals}-${finalMatch.awayGoals} ${finalMatch.awayTeamName}`,
  );
  console.log(`Rosa: ${roster.entries.length} righe, ${roster.teamCredits.length} squadre`);

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
      gironeA: { folder: COPPA_GIRONE_A_DIR },
      gironeB: { folder: COPPA_GIRONE_B_DIR },
      faseFinale: { folder: COPPA_FASE_FINALE_DIR },
    },
  });

  // Registra gli alias confermati PRIMA della risoluzione squadre, così
  // seedTeamsFromNames trova già l'identità corretta invece di crearne una
  // nuova per errore.
  await repo.upsertTeams(
    CONFIRMED_TEAM_MERGES.map((m) => ({ name: m.canonicalName, aliases: [m.seasonAlias] })),
  );

  await seedTeamsFromNames(seasonId, teamNames, repo);
  console.log(`Seed squadre: ${teamNames.size} squadre`);

  const playerNames = new Set(roster.entries.map((e) => e.playerName.trim()));
  await repo.upsertPlayers([...playerNames].map((name) => ({ name })));
  console.log(`Seed giocatori: ${playerNames.size}`);

  await repo.upsertRoster(roster);
  await repo.upsertStandings(campionatoStandings);
  await repo.upsertStandings(gironeAStandings);
  await repo.upsertStandings(gironeBStandings);
  await repo.upsertCalendar(campionatoCalendar);
  await repo.upsertCalendar(faseFinaleCalendar);

  console.log('\nCaricamento branding (loghi/maglie):');
  const teamNamesById = teamNameById(extractTeamBlobs(await readFile(campionatoCalendarFile, 'utf-8')));
  await seedBranding2018_19(client, seasonId, teamNamesById);

  console.log(`\nImport ${SEASON.slug} completato.`);
}

main().catch((err: unknown) => {
  console.error(`Import ${SEASON.slug} fallito:`, err);
  process.exit(1);
});
