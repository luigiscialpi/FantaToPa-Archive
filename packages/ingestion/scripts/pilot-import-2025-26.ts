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
import { readdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { normalizeName } from '../lib/normalize-name.js';

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
      lineups: path.join(ROOT, 'Coppa', 'Gruppo A'),
    },
    gironeB: {
      standings: path.join(ROOT, 'Coppa', 'Gruppo B', 'Classifica_COPPA-LELLE-GIR.-B.xlsx'),
      lineups: path.join(ROOT, 'Coppa', 'Gruppo B'),
    },
    faseFinale: {
      calendar: path.join(ROOT, 'Coppa', 'Fase Finale', 'Calendario_COPPA-LELLE-FASE-FINALE.xlsx'),
      lineups: path.join(ROOT, 'Coppa', 'Fase Finale'),
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

// Nel dataset, un giocatore compare con un'iniziale finale ("Ordonez C.") solo
// quando serve a distinguerlo da un omonimo. stripInitial toglie quella parte
// per confrontare il "nome base"; initialLetter la estrae per disambiguare
// quando esistono più candidati con lo stesso nome base.
function stripInitial(name: string): string {
  return name.replace(/\s+[A-Z]\.?$/i, '').trim();
}

function initialLetter(name: string): string | undefined {
  const m = /\s+([A-Z])\.?$/i.exec(name.trim());
  return m ? m[1]!.toUpperCase() : undefined;
}

const ALIAS_OVERRIDES_FILE = path.join(ROOT, 'player-alias-overrides.json');

async function loadAliasOverrides(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(ALIAS_OVERRIDES_FILE, 'utf-8');
    return JSON.parse(raw) as Record<string, string>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

async function seedPlayersFromLineups(): Promise<void> {
  const lineupFolders = [
    FILES.campionato.lineups,
    FILES.coppa.gironeA.lineups,
    FILES.coppa.gironeB.lineups,
    FILES.coppa.faseFinale.lineups,
  ];

  const lineupNames = new Set<string>();
  for (const folder of lineupFolders) {
    const files = (await readdir(folder))
      .filter((f) => f.toLowerCase().startsWith('formazioni') && f.toLowerCase().endsWith('.xlsx'));
    for (const file of files) {
      const adapter = new XlsxLineupAdapter(SEASON_SLUG, 'x');
      const lineup = await adapter.parse(path.join(folder, file));
      for (const match of lineup.matches) {
        for (const side of [match.home, match.away]) {
          for (const pl of side.players) lineupNames.add(pl.playerName.trim());
        }
      }
    }
  }

  const { data: allPlayers, error: playersError } = await client
    .from('players')
    .select('id, canonical_name, player_aliases(alias_normalized)');
  if (playersError || !allPlayers) {
    throw new Error(`Errore caricamento giocatori per seed formazioni: ${playersError?.message ?? 'dati assenti'}`);
  }

  const knownExact = new Set<string>();
  const byBaseName = new Map<string, { id: string; canonicalName: string }[]>();
  for (const p of allPlayers) {
    knownExact.add(normalizeName(p.canonical_name));
    for (const a of (p.player_aliases as { alias_normalized: string }[] | null) ?? []) {
      knownExact.add(a.alias_normalized);
    }
    const base = normalizeName(stripInitial(p.canonical_name));
    byBaseName.set(base, [...(byBaseName.get(base) ?? []), { id: p.id, canonicalName: p.canonical_name }]);
  }

  const overrides = await loadAliasOverrides();

  const aliasesToAdd = new Map<string, string[]>();
  const newPlayerNames = new Set<string>();
  const unresolved = new Map<string, string[]>();

  for (const name of lineupNames) {
    const key = normalizeName(name);
    if (knownExact.has(key)) continue;

    const overrideTarget = overrides[name];
    if (overrideTarget) {
      const targetKey = normalizeName(overrideTarget);
      const targetPlayer = allPlayers.find((p) => normalizeName(p.canonical_name) === targetKey);
      if (targetPlayer) {
        const arr = aliasesToAdd.get(targetPlayer.id) ?? [];
        if (!arr.includes(key)) arr.push(key);
        aliasesToAdd.set(targetPlayer.id, arr);
        knownExact.add(key);
        continue;
      }
    }

    const base = normalizeName(stripInitial(name));
    const candidates = byBaseName.get(base) ?? [];

    if (candidates.length === 1) {
      const playerId = candidates[0]!.id;
      const arr = aliasesToAdd.get(playerId) ?? [];
      if (!arr.includes(key)) arr.push(key);
      aliasesToAdd.set(playerId, arr);
      knownExact.add(key);
      continue;
    }

    if (candidates.length > 1) {
      const initial = initialLetter(name);
      const byInitial = initial ? candidates.filter((c) => initialLetter(c.canonicalName) === initial) : [];
      if (byInitial.length === 1) {
        const playerId = byInitial[0]!.id;
        const arr = aliasesToAdd.get(playerId) ?? [];
        if (!arr.includes(key)) arr.push(key);
        aliasesToAdd.set(playerId, arr);
        knownExact.add(key);
        continue;
      }
      unresolved.set(name, candidates.map((c) => c.canonicalName));
      continue;
    }

    // Nessun candidato con lo stesso nome base: giocatore genuinamente nuovo
    // (non in rosa d'asta, es. preso a stagione in corso).
    newPlayerNames.add(name);
  }

  if (unresolved.size > 0) {
    const merged: Record<string, string | null> = { ...overrides };
    for (const [name, candidates] of unresolved) {
      merged[name] = merged[name] ?? (candidates.length === 1 ? (candidates[0] ?? null) : null);
    }
    await writeFile(ALIAS_OVERRIDES_FILE, `${JSON.stringify(merged, null, 2)}\n`, 'utf-8');

    console.error(`\n${unresolved.size} nomi ambigui nelle formazioni, serve conferma manuale.`);
    console.error(`Apri ${ALIAS_OVERRIDES_FILE}, per ogni voce imposta il nome canonico corretto tra i candidati, poi rilancia lo script.\n`);
    for (const [name, candidates] of unresolved) {
      console.error(`  "${name}" -> candidati: ${candidates.join(' | ')}`);
    }
    process.exit(1);
  }

  for (const [playerId, aliases] of aliasesToAdd) {
    await repo.ensurePlayerAliases(playerId, aliases);
  }
  await repo.upsertPlayers([...newPlayerNames].map((name) => ({ name })));

  console.log(`Formazioni: ${aliasesToAdd.size} alias risolti, ${newPlayerNames.size} nuovi giocatori`);
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
    .filter((f) => f.toLowerCase().startsWith('formazioni') && f.toLowerCase().endsWith('.xlsx'))
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
  await seedPlayersFromLineups();
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
