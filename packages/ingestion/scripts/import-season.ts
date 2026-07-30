// packages/ingestion/scripts/import-season.ts
//
// Import generalizzato multi-stagione su Supabase — sostituisce
// pilot-import-2025-26.ts (che hardcodava percorsi/nomi file/ruoli solo per
// il 2025-26). Da eseguire manualmente, una stagione alla volta, con le env
// var SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY:
//
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-season.ts <slug>
//
// <slug> è uno degli slug in season-configs.ts (es. "2024-25"). La struttura
// delle cartelle è dichiarata lì (varia stagione per stagione in modo non
// prevedibile); i nomi file dentro ogni cartella sono scoperti per
// prefisso+estensione (lib/discover-files.ts) invece che hardcodati.
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { XlsxRosterAdapter } from '../adapters/xlsx/roster.js';
import { XlsxStandingsAdapter } from '../adapters/xlsx/standings.js';
import { XlsxCalendarAdapter } from '../adapters/xlsx/calendar.js';
import { XlsxLineupAdapter } from '../adapters/xlsx/lineup.js';
import { findXlsxByPrefix, listXlsxByPrefix } from '../lib/discover-files.js';
import { getSeasonConfig, type SeasonConfig } from './season-configs.js';
import { TEAM_REGISTRY } from './team-registry.js';
import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { normalizeName } from '../lib/normalize-name.js';

type SupabaseClient = ReturnType<typeof createIngestionClient>;

async function ensureSeason(client: SupabaseClient, config: SeasonConfig): Promise<string> {
  const { data } = await client.from('seasons').select('id').eq('slug', config.slug).maybeSingle();
  if (data) return data.id;

  const { data: created, error } = await client
    .from('seasons')
    .insert({ slug: config.slug, label: config.label, starts_on: config.startsOn, ends_on: config.endsOn })
    .select('id')
    .single();
  if (error || !created) throw new Error(`Errore creazione stagione: ${error?.message ?? 'riga assente'}`);
  console.log(`Stagione ${config.slug} creata`);
  return created.id;
}

async function ensureLookups(client: SupabaseClient): Promise<void> {
  await client.from('competition_kinds').upsert([
    { code: 'campionato', label: 'Campionato' },
    { code: 'coppa_girone', label: 'Coppa - Girone' },
    { code: 'coppa_fase_finale', label: 'Coppa - Fase Finale' },
    { code: 'coppa_spareggio', label: 'Coppa - Spareggio' },
  ]);
  await client.from('competition_formats').upsert([
    { code: 'girone_unico', label: 'Girone unico' },
    { code: 'gironi', label: 'Gironi' },
    { code: 'eliminazione_diretta', label: 'Eliminazione diretta' },
  ]);
  await client.from('roles').upsert([
    // Mantra (2023-24 in poi, e 2025-26): il fatto che il 2023-24 non usi
    // "B" non richiede nulla qui, semplicemente quella riga non viene mai
    // referenziata da player_roles per quella stagione.
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
    // Classico (2020-21, 2021-22, 2022-23): "C" e "A" hanno lo stesso
    // significato che in Mantra (Centrocampista/Attaccante), niente riga
    // duplicata per quei due codici — servono solo "P" e "D" in più.
    { code: 'P', label: 'Portiere', ruleset: 'classico' },
    { code: 'D', label: 'Difensore', ruleset: 'classico' },
  ]);
  await client.from('import_source_types').upsert([
    { code: 'xlsx', label: 'Excel' },
    { code: 'ocr_image', label: 'OCR da immagine' },
    { code: 'html_legacy', label: 'HTML legacy' },
    { code: 'manual', label: 'Manuale' },
  ]);
  console.log('Lookup tables popolate');
}

async function ensureCompetitions(client: SupabaseClient, seasonId: string, config: SeasonConfig): Promise<void> {
  const competitions: { slug: string; name: string; kind_code: string; format_code: string }[] = [
    { slug: 'campionato', name: 'Campionato FantaTopa', kind_code: 'campionato', format_code: 'girone_unico' },
  ];
  if (config.coppa?.gironeA) {
    competitions.push({ slug: 'coppa-girone-a', name: 'Coppa Lelle - Girone A', kind_code: 'coppa_girone', format_code: 'gironi' });
  }
  if (config.coppa?.gironeB) {
    competitions.push({ slug: 'coppa-girone-b', name: 'Coppa Lelle - Girone B', kind_code: 'coppa_girone', format_code: 'gironi' });
  }
  if (config.coppa?.faseFinale) {
    competitions.push({ slug: 'coppa-fase-finale', name: 'Coppa Lelle - Fase Finale', kind_code: 'coppa_fase_finale', format_code: 'eliminazione_diretta' });
  }
  if (config.coppa?.spareggio) {
    competitions.push({ slug: 'coppa-spareggio', name: 'Coppa Lelle - Spareggio', kind_code: 'coppa_spareggio', format_code: 'eliminazione_diretta' });
  }

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

async function loadAliasOverrides(file: string): Promise<Record<string, string>> {
  try {
    const raw = await readFile(file, 'utf-8');
    return JSON.parse(raw) as Record<string, string>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

// Cartelle formazioni configurate per questa stagione (campionato sempre,
// coppa solo per le sotto-competizioni presenti).
function lineupFolders(config: SeasonConfig): { folder: string; competitionSlug: string }[] {
  const folders = [{ folder: config.campionato.lineupsFolder, competitionSlug: 'campionato' }];
  if (config.coppa?.gironeA) folders.push({ folder: config.coppa.gironeA.folder, competitionSlug: 'coppa-girone-a' });
  if (config.coppa?.gironeB) folders.push({ folder: config.coppa.gironeB.folder, competitionSlug: 'coppa-girone-b' });
  if (config.coppa?.faseFinale) folders.push({ folder: config.coppa.faseFinale.folder, competitionSlug: 'coppa-fase-finale' });
  if (config.coppa?.spareggio) folders.push({ folder: config.coppa.spareggio.folder, competitionSlug: 'coppa-spareggio' });
  return folders;
}

// Nomi squadra di QUESTA stagione: dalla rosa d'asta quando esiste, altrimenti
// (2022-23) dalla classifica campionato — non ci sono giocatori da seminare
// in quel caso, solo squadre (i giocatori arrivano comunque dalle formazioni).
async function collectSeasonTeamNames(config: SeasonConfig): Promise<Set<string>> {
  const names = new Set<string>();

  const rosterFile = config.rosterFolder ? await findXlsxByPrefix(config.rosterFolder, 'rose') : undefined;
  if (rosterFile) {
    const roster = await new XlsxRosterAdapter(config.slug).parse(rosterFile);
    for (const entry of roster.entries) names.add(entry.teamName.trim());
    return names;
  }

  const standingsFile = await findXlsxByPrefix(config.campionato.folder, 'classifica');
  if (!standingsFile) throw new Error(`Nessuna rosa né classifica campionato trovata per ${config.slug}`);
  const standings = await new XlsxStandingsAdapter(config.slug, 'campionato').parse(standingsFile);
  for (const row of standings.rows) names.add(row.teamName.trim());
  return names;
}

async function seedTeams(config: SeasonConfig, repo: SupabaseSeasonRepository): Promise<void> {
  // Registro squadre (identità persistenti tra stagioni): seminato per
  // intero ad ogni run, indipendentemente da quale stagione si sta
  // importando — idempotente, upsertTeams riusa la squadra se il nome
  // canonico esiste già.
  await repo.upsertTeams(TEAM_REGISTRY.map((t) => ({ name: t.canonicalName, aliases: t.aliases })));

  // Fallback per nomi di questa stagione non coperti dal registro (non
  // dovrebbe succedere per le 6 stagioni note, protegge da sorprese).
  const teamNames = await collectSeasonTeamNames(config);
  const unresolved: string[] = [];
  for (const name of teamNames) {
    if (!(await repo.resolveTeamId(name))) unresolved.push(name);
  }
  if (unresolved.length > 0) {
    await repo.upsertTeams(unresolved.map((name) => ({ name })));
    console.log(`Squadre non nel registro (aggiunte come nuove): ${unresolved.join(', ')}`);
  }
  console.log(`Seed squadre: ${teamNames.size} squadre per ${config.slug}`);
}

async function seedPlayersFromRoster(config: SeasonConfig, repo: SupabaseSeasonRepository): Promise<void> {
  const rosterFile = config.rosterFolder ? await findXlsxByPrefix(config.rosterFolder, 'rose') : undefined;
  if (!rosterFile) {
    console.log(`${config.slug}: nessuna rosa d'asta, giocatori seminati solo dalle formazioni`);
    return;
  }
  const roster = await new XlsxRosterAdapter(config.slug).parse(rosterFile);
  const playerNames = new Set(roster.entries.map((e) => e.playerName.trim()));
  await repo.upsertPlayers([...playerNames].map((name) => ({ name })));
  console.log(`Seed: ${playerNames.size} giocatori da rosa`);
}

async function seedPlayersFromLineups(client: SupabaseClient, config: SeasonConfig, repo: SupabaseSeasonRepository): Promise<void> {
  const lineupNames = new Set<string>();
  for (const { folder } of lineupFolders(config)) {
    const files = await listXlsxByPrefix(folder, 'formazioni');
    for (const file of files) {
      const lineup = await new XlsxLineupAdapter(config.slug, 'x').parse(file);
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

  const aliasOverridesFile = path.join(config.root, 'player-alias-overrides.json');
  const overrides = await loadAliasOverrides(aliasOverridesFile);

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
    // (non in rosa d'asta, es. preso a stagione in corso, o stagione senza rosa).
    newPlayerNames.add(name);
  }

  if (unresolved.size > 0) {
    const merged: Record<string, string | null> = { ...overrides };
    for (const [name, candidates] of unresolved) {
      merged[name] = merged[name] ?? (candidates.length === 1 ? (candidates[0] ?? null) : null);
    }
    await writeFile(aliasOverridesFile, `${JSON.stringify(merged, null, 2)}\n`, 'utf-8');

    console.error(`\n${unresolved.size} nomi ambigui nelle formazioni, serve conferma manuale.`);
    console.error(`Apri ${aliasOverridesFile}, per ogni voce imposta il nome canonico corretto tra i candidati, poi rilancia lo script.\n`);
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

async function importRoster(config: SeasonConfig, repo: SupabaseSeasonRepository): Promise<void> {
  const rosterFile = config.rosterFolder ? await findXlsxByPrefix(config.rosterFolder, 'rose') : undefined;
  if (!rosterFile) {
    console.log(`${config.slug}: nessuna rosa d'asta da importare`);
    return;
  }
  const roster = await new XlsxRosterAdapter(config.slug).parse(rosterFile);
  await repo.upsertRoster(roster);
  console.log(`Rosa importata: ${roster.entries.length} righe`);
}

async function importStandings(config: SeasonConfig, repo: SupabaseSeasonRepository): Promise<void> {
  const campionatoFile = await findXlsxByPrefix(config.campionato.folder, 'classifica');
  if (!campionatoFile) throw new Error(`Classifica campionato non trovata per ${config.slug}`);
  await repo.upsertStandings(await new XlsxStandingsAdapter(config.slug, 'campionato').parse(campionatoFile));
  console.log('Classifica campionato importata');

  if (config.coppa?.gironeA) {
    const file = await findXlsxByPrefix(config.coppa.gironeA.folder, 'classifica', '-a');
    if (file) {
      await repo.upsertStandings(await new XlsxStandingsAdapter(config.slug, 'coppa-girone-a').parse(file));
      console.log('Classifica Coppa girone A importata');
    } else {
      console.log(`${config.slug}: classifica Coppa girone A non trovata, salto`);
    }
  }
  if (config.coppa?.gironeB) {
    const file = await findXlsxByPrefix(config.coppa.gironeB.folder, 'classifica', '-b');
    if (file) {
      await repo.upsertStandings(await new XlsxStandingsAdapter(config.slug, 'coppa-girone-b').parse(file));
      console.log('Classifica Coppa girone B importata');
    } else {
      console.log(`${config.slug}: classifica Coppa girone B non trovata, salto`);
    }
  }
}

async function importCalendars(config: SeasonConfig, repo: SupabaseSeasonRepository): Promise<void> {
  const campionatoFile = await findXlsxByPrefix(config.campionato.folder, 'calendario');
  if (!campionatoFile) throw new Error(`Calendario campionato non trovato per ${config.slug}`);
  await repo.upsertCalendar(await new XlsxCalendarAdapter(config.slug, 'campionato').parse(campionatoFile));
  console.log('Calendario campionato importato');

  if (config.coppa?.faseFinale) {
    const file = await findXlsxByPrefix(config.coppa.faseFinale.folder, 'calendario', 'fase');
    if (file) {
      await repo.upsertCalendar(await new XlsxCalendarAdapter(config.slug, 'coppa-fase-finale').parse(file));
      console.log('Calendario Coppa fase finale importato');
    } else {
      console.log(`${config.slug}: calendario Coppa fase finale non trovato, salto`);
    }
  }
}

async function importLineups(folder: string, competitionSlug: string, config: SeasonConfig, repo: SupabaseSeasonRepository): Promise<void> {
  const files = await listXlsxByPrefix(folder, 'formazioni');

  for (const file of files) {
    const match = path.basename(file).match(/(\d+)/);
    const matchdayNumber = match ? Number(match[1]) : 0;
    if (matchdayNumber === 0) {
      console.log(`  skip ${path.basename(file)}: numero giornata non trovato`);
      continue;
    }

    const lineup = await new XlsxLineupAdapter(config.slug, competitionSlug).parse(file);
    await repo.upsertLineup(lineup);
    console.log(`  ${competitionSlug} giornata ${matchdayNumber}: ${lineup.matches.length} partite`);
  }
}

async function importSeason(slug: string): Promise<void> {
  const config = getSeasonConfig(slug);
  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);

  const seasonId = await ensureSeason(client, config);
  await ensureLookups(client);
  await ensureCompetitions(client, seasonId, config);

  await seedTeams(config, repo);
  await seedPlayersFromRoster(config, repo);
  await seedPlayersFromLineups(client, config, repo);
  await importRoster(config, repo);
  await importStandings(config, repo);
  await importCalendars(config, repo);

  for (const { folder, competitionSlug } of lineupFolders(config)) {
    await importLineups(folder, competitionSlug, config, repo);
  }

  console.log(`\nImport ${config.slug} completato.`);
}

const seasonSlug = process.argv[2];
if (!seasonSlug) {
  console.error('Uso: tsx import-season.ts <slug-stagione> (es. 2024-25)');
  process.exit(1);
}

importSeason(seasonSlug).catch((err: unknown) => {
  console.error(`Import ${seasonSlug} fallito:`, err);
  process.exit(1);
});
