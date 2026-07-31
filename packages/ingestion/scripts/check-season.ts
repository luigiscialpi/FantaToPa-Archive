// packages/ingestion/scripts/check-season.ts
//
// Validazione SENZA Supabase (nessuna rete, nessuna scrittura): risolve i
// percorsi di una season-config, fa girare gli adapter reali su ogni file
// configurato e stampa conteggi/anomalie. Pensato per essere lanciato PRIMA
// di import-season.ts su una stagione mai importata — stessa idea della
// verifica di compatibilità fatta a mano per le 5 stagioni legacy, ma
// guidata dalla config invece che da script usa-e-getta.
//
//   ./node_modules/.bin/tsx packages/ingestion/scripts/check-season.ts <slug|all>
import { XlsxRosterAdapter } from '../adapters/xlsx/roster.js';
import { XlsxStandingsAdapter } from '../adapters/xlsx/standings.js';
import { XlsxCalendarAdapter } from '../adapters/xlsx/calendar.js';
import { XlsxLineupAdapter } from '../adapters/xlsx/lineup.js';
import { findXlsxByPrefix, listXlsxByPrefix } from '../lib/discover-files.js';
import { SEASON_CONFIGS, getSeasonConfig, type SeasonConfig } from './season-configs.js';
import { loadTeamRegistry, type TeamIdentity } from './team-registry.js';
import { normalizeName } from '../lib/normalize-name.js';

function isKnownTeamName(name: string, knownNormalized: Set<string>): boolean {
  return knownNormalized.has(normalizeName(name));
}

async function checkSeason(config: SeasonConfig, registry: TeamIdentity[]): Promise<{ ok: boolean; issues: string[] }> {
  const issues: string[] = [];
  console.log(`\n=== ${config.slug} (${config.ruleset}) ===`);

  const knownNormalized = new Set<string>();
  for (const t of registry) {
    knownNormalized.add(normalizeName(t.canonicalName));
    for (const a of t.aliases) knownNormalized.add(normalizeName(a));
  }

  const teamNames = new Set<string>();

  // Rosa
  if (config.rosterFolder) {
    const rosterFile = await findXlsxByPrefix(config.rosterFolder, 'rose');
    if (!rosterFile) {
      issues.push('rosterFolder configurato ma nessun file Rose_*.xlsx trovato');
    } else {
      const roster = await new XlsxRosterAdapter(config.slug).parse(rosterFile);
      const players = new Set(roster.entries.map((e) => e.playerName.trim()));
      for (const e of roster.entries) teamNames.add(e.teamName.trim());
      console.log(`  rosa: ${roster.entries.length} righe, ${teamNames.size} squadre, ${players.size} giocatori`);
    }
  } else {
    console.log('  rosa: assente (atteso per questa stagione)');
  }

  // Classifica campionato
  const campStandingsFile = await findXlsxByPrefix(config.campionato.folder, 'classifica');
  if (!campStandingsFile) {
    issues.push('classifica campionato non trovata');
  } else {
    const standings = await new XlsxStandingsAdapter(config.slug, 'campionato').parse(campStandingsFile);
    for (const r of standings.rows) teamNames.add(r.teamName.trim());
    console.log(`  classifica campionato: ${standings.rows.length} righe`);
    if (standings.rows.length === 0) issues.push('classifica campionato: 0 righe');
  }

  // Calendario campionato
  const campCalendarFile = await findXlsxByPrefix(config.campionato.folder, 'calendario');
  if (!campCalendarFile) {
    issues.push('calendario campionato non trovato');
  } else {
    const calendar = await new XlsxCalendarAdapter(config.slug, 'campionato').parse(campCalendarFile);
    console.log(`  calendario campionato: ${calendar.matchdays.length} giornate`);
    if (calendar.matchdays.length === 0) issues.push('calendario campionato: 0 giornate');
  }

  // Coppa gironi: classifica
  for (const [key, letter] of [['gironeA', '-a'] as const, ['gironeB', '-b'] as const]) {
    const group = config.coppa?.[key];
    if (!group) continue;
    const file = await findXlsxByPrefix(group.folder, 'classifica', letter);
    if (!file) {
      issues.push(`classifica coppa ${key} non trovata in ${group.folder}`);
      continue;
    }
    const standings = await new XlsxStandingsAdapter(config.slug, `coppa-${key === 'gironeA' ? 'girone-a' : 'girone-b'}`).parse(file);
    for (const r of standings.rows) teamNames.add(r.teamName.trim());
    console.log(`  classifica coppa ${key}: ${standings.rows.length} righe`);
    if (standings.rows.length === 0) issues.push(`classifica coppa ${key}: 0 righe`);
  }

  // Coppa fase finale: calendario
  if (config.coppa?.faseFinale) {
    const file = await findXlsxByPrefix(config.coppa.faseFinale.folder, 'calendario', 'fase');
    if (!file) {
      console.log('  calendario coppa fase finale: non trovato (nessuna azione, non importato per questa stagione)');
    } else {
      const calendar = await new XlsxCalendarAdapter(config.slug, 'coppa-fase-finale').parse(file);
      console.log(`  calendario coppa fase finale: ${calendar.matchdays.length} giornate`);
      if (calendar.matchdays.length === 0) issues.push('calendario coppa fase finale: 0 giornate');
    }
  }

  // Formazioni: campionato + ogni sottocompetizione coppa configurata
  const lineupGroups: { label: string; folder: string; competitionSlug: string }[] = [
    { label: 'campionato', folder: config.campionato.lineupsFolder, competitionSlug: 'campionato' },
  ];
  if (config.coppa?.gironeA) lineupGroups.push({ label: 'coppa gironeA', folder: config.coppa.gironeA.folder, competitionSlug: 'coppa-girone-a' });
  if (config.coppa?.gironeB) lineupGroups.push({ label: 'coppa gironeB', folder: config.coppa.gironeB.folder, competitionSlug: 'coppa-girone-b' });
  if (config.coppa?.faseFinale) lineupGroups.push({ label: 'coppa faseFinale', folder: config.coppa.faseFinale.folder, competitionSlug: 'coppa-fase-finale' });
  if (config.coppa?.spareggio) lineupGroups.push({ label: 'coppa spareggio', folder: config.coppa.spareggio.folder, competitionSlug: 'coppa-spareggio' });

  for (const group of lineupGroups) {
    const files = await listXlsxByPrefix(group.folder, 'formazioni');
    let matches = 0;
    let anomalies = 0;
    let parseErrors = 0;
    for (const file of files) {
      try {
        const lineup = await new XlsxLineupAdapter(config.slug, group.competitionSlug).parse(file);
        for (const m of lineup.matches) {
          matches += 1;
          for (const side of [m.home, m.away]) {
            teamNames.add(side.teamName.trim());
            if (side.players.filter((p) => p.slot === 'titolare').length !== 11 || side.total === 0) anomalies += 1;
          }
        }
      } catch (err) {
        parseErrors += 1;
        issues.push(`${group.label}: errore parsing ${file}: ${(err as Error).message}`);
      }
    }
    console.log(`  formazioni ${group.label}: ${files.length} file, ${matches} partite, ${anomalies} anomalie, ${parseErrors} errori parsing`);
    if (anomalies > 0) issues.push(`formazioni ${group.label}: ${anomalies} anomalie (titolari!==11 o total===0)`);
  }

  // Copertura registro squadre
  const uncovered = [...teamNames].filter((n) => !isKnownTeamName(n, knownNormalized));
  if (uncovered.length > 0) {
    issues.push(`squadre non coperte dal registro: ${uncovered.join(', ')}`);
  }
  console.log(`  squadre totali osservate: ${teamNames.size}, non coperte dal registro: ${uncovered.length}`);

  return { ok: issues.length === 0, issues };
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  const configs = !arg || arg === 'all' ? SEASON_CONFIGS : [getSeasonConfig(arg)];
  const registry = await loadTeamRegistry();

  const allIssues: string[] = [];
  for (const config of configs) {
    const { ok, issues } = await checkSeason(config, registry);
    if (!ok) allIssues.push(...issues.map((i) => `[${config.slug}] ${i}`));
  }

  console.log('\n=== Riepilogo ===');
  if (allIssues.length === 0) {
    console.log('Nessun problema trovato.');
  } else {
    console.log(`${allIssues.length} problemi:`);
    for (const issue of allIssues) console.log(`  - ${issue}`);
    process.exitCode = 1;
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
