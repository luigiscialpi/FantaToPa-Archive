// packages/ingestion/scripts/backfill-team-branding-2025-26.ts
//
// Una tantum, da eseguire dopo la migrazione che ha aggiunto
// team_seasons.credits_remaining e il bucket Storage "team-branding":
//   1. ri-legge la rosa 2025-26 (upsertRoster, idempotente) per backfillare
//      i crediti residui, finora ignorati dall'adapter;
//   2. carica su Storage i loghi/maglie disponibili in
//      docs/Fantacalcio 2025-2026/Loghi & Maglie/, associandoli alla
//      squadra tramite normalizeName() (i nomi file sono "sporchi": spazi
//      finali, punteggiatura tipo "S.F.."), e aggiorna
//      team_seasons.logo_url/jersey_url.
// Solo una minoranza delle 10 squadre ha già un'immagine: normale, non un
// errore — lo script logga chiaramente chi resta senza.
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { createIngestionClient } from '../lib/supabase-client.js';
import { normalizeName } from '../lib/normalize-name.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { XlsxRosterAdapter } from '../adapters/xlsx/roster.js';

const SEASON_SLUG = '2025-26';
const ROOT = fileURLToPath(new URL('../../../docs/Fantacalcio 2025-2026', import.meta.url));
const ROSTER_FILE = path.join(ROOT, 'Rose_fantatopa.xlsx');
const LOGHI_DIR = path.join(ROOT, 'Loghi & Maglie', 'Loghi');
const MAGLIE_DIR = path.join(ROOT, 'Loghi & Maglie', 'Maglie');

const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|webp)$/i;

type IngestionClient = ReturnType<typeof createIngestionClient>;
type TeamRow = { id: string; slug: string; canonicalName: string };
type AssetKind = 'logo' | 'jersey';

async function buildTeamLookup(client: IngestionClient): Promise<Map<string, TeamRow>> {
  const { data: teams, error: teamsError } = await client.from('teams').select('id, slug, canonical_name');
  if (teamsError) throw new Error(`Errore lettura squadre: ${teamsError.message}`);

  const { data: aliases, error: aliasError } = await client.from('team_aliases').select('team_id, alias_normalized');
  if (aliasError) throw new Error(`Errore lettura alias squadre: ${aliasError.message}`);

  const byId = new Map(teams.map((team) => [team.id, team]));
  const lookup = new Map<string, TeamRow>();

  for (const team of teams) {
    lookup.set(normalizeName(team.canonical_name), {
      id: team.id,
      slug: team.slug,
      canonicalName: team.canonical_name,
    });
  }
  for (const alias of aliases) {
    const team = byId.get(alias.team_id);
    if (team) {
      lookup.set(alias.alias_normalized, { id: team.id, slug: team.slug, canonicalName: team.canonical_name });
    }
  }

  return lookup;
}

async function listImageFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  return entries.filter((name) => IMAGE_EXTENSION_PATTERN.test(name)).map((name) => path.join(dir, name));
}

async function uploadAndAssign(
  client: IngestionClient,
  seasonId: string,
  team: TeamRow,
  kind: AssetKind,
  filePath: string,
): Promise<void> {
  const ext = path.extname(filePath).slice(1).toLowerCase() || 'png';
  const storagePath = `${SEASON_SLUG}/${team.slug}/${kind}.${ext}`;
  const buffer = await readFile(filePath);

  const { error: uploadError } = await client.storage.from('team-branding').upload(storagePath, buffer, {
    contentType: ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png',
    upsert: true,
  });
  if (uploadError) throw new Error(`Errore upload ${kind} per "${team.canonicalName}": ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = client.storage.from('team-branding').getPublicUrl(storagePath);

  const patch = kind === 'logo' ? { logo_url: publicUrl } : { jersey_url: publicUrl };
  const { error: updateError } = await client
    .from('team_seasons')
    .upsert({ team_id: team.id, season_id: seasonId, ...patch }, { onConflict: 'team_id, season_id' });
  if (updateError) throw new Error(`Errore aggiornamento ${kind} per "${team.canonicalName}": ${updateError.message}`);

  console.log(`  OK ${kind === 'logo' ? 'logo ' : 'maglia'} -> ${team.canonicalName} (${storagePath})`);
}

async function processAssets(
  client: IngestionClient,
  seasonId: string,
  lookup: Map<string, TeamRow>,
  dir: string,
  kind: AssetKind,
): Promise<void> {
  const files = await listImageFiles(dir);
  console.log(`\n${kind === 'logo' ? 'Loghi' : 'Maglie'}: ${files.length} file in ${dir}`);

  for (const filePath of files) {
    const baseName = path.basename(filePath, path.extname(filePath)).trim();
    const team = lookup.get(normalizeName(baseName));
    if (!team) {
      console.warn(`  ? nessuna squadra riconosciuta per "${path.basename(filePath)}"`);
      continue;
    }
    await uploadAndAssign(client, seasonId, team, kind, filePath);
  }
}

async function main(): Promise<void> {
  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);

  const rosterAdapter = new XlsxRosterAdapter(SEASON_SLUG);
  await repo.upsertRoster(await rosterAdapter.parse(ROSTER_FILE));
  console.log('Crediti residui backfillati da', ROSTER_FILE);

  const { data: seasonRow, error: seasonError } = await client
    .from('seasons')
    .select('id')
    .eq('slug', SEASON_SLUG)
    .single();
  if (seasonError || !seasonRow) {
    throw new Error(`Stagione "${SEASON_SLUG}" non trovata: ${seasonError?.message ?? 'riga assente'}`);
  }

  const lookup = await buildTeamLookup(client);
  await processAssets(client, seasonRow.id, lookup, LOGHI_DIR, 'logo');
  await processAssets(client, seasonRow.id, lookup, MAGLIE_DIR, 'jersey');

  const { data: brandingRows, error: brandingError } = await client
    .from('team_seasons')
    .select('team_id, logo_url, jersey_url, credits_remaining')
    .eq('season_id', seasonRow.id);
  if (brandingError) throw new Error(`Errore lettura riepilogo: ${brandingError.message}`);

  const teamNameById = new Map([...lookup.values()].map((team) => [team.id, team.canonicalName]));
  console.log(`\nRiepilogo branding stagione ${SEASON_SLUG}:`);
  for (const row of brandingRows) {
    const name = teamNameById.get(row.team_id) ?? row.team_id;
    const logoMark = row.logo_url ? '✓' : '·';
    const jerseyMark = row.jersey_url ? '✓' : '·';
    console.log(`  logo ${logoMark}  maglia ${jerseyMark}  crediti ${row.credits_remaining ?? '–'}  — ${name}`);
  }
}

main().catch((err: unknown) => {
  console.error('Backfill branding fallito:', err);
  process.exit(1);
});
