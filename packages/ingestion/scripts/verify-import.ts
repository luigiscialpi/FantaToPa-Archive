// packages/ingestion/scripts/verify-import.ts
//
// Verifica post-import: legge da Supabase i conteggi reali di una stagione
// già importata (competizioni/giornate/partite/formazioni/rose) così da
// confrontarli con quelli attesi calcolati sui file sorgente da
// check-season.ts, prima di considerare l'import concluso.
import 'dotenv/config';
import { createIngestionClient } from '../lib/supabase-client.js';

// PostgREST rifiuta filtri .in() con troppi id in una singola richiesta
// (header HTTP oltre ~16KB, visto con 224 id): a chunk per restare sotto il
// limite, indipendentemente da quanto cresce una stagione.
const CHUNK_SIZE = 100;

async function selectInChunks<T>(
  queryFn: (batch: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  ids: string[],
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const batch = ids.slice(i, i + CHUNK_SIZE);
    const { data, error } = await queryFn(batch);
    if (error) throw new Error(error.message);
    results.push(...(data ?? []));
  }
  return results;
}

async function countInChunks(
  queryFn: (batch: string[]) => PromiseLike<{ count: number | null; error: { message: string } | null }>,
  ids: string[],
): Promise<number> {
  let total = 0;
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const batch = ids.slice(i, i + CHUNK_SIZE);
    const { count, error } = await queryFn(batch);
    if (error) throw new Error(error.message);
    total += count ?? 0;
  }
  return total;
}

async function verifyImport(slug: string): Promise<void> {
  const client = createIngestionClient();

  const { data: season, error: seasonErr } = await client
    .from('seasons')
    .select('id, label')
    .eq('slug', slug)
    .single();
  if (seasonErr || !season) {
    throw new Error(`Stagione "${slug}" non trovata su Supabase: ${seasonErr?.message}`);
  }

  const { data: competitions, error: compErr } = await client
    .from('competitions')
    .select('id, slug')
    .eq('season_id', season.id);
  if (compErr) throw compErr;
  const competitionIds = (competitions ?? []).map((c) => c.id);

  const { data: matchdays, error: mdErr } = await client
    .from('matchdays')
    .select('id, competition_id')
    .in('competition_id', competitionIds);
  if (mdErr) throw mdErr;
  const matchdayIds = (matchdays ?? []).map((m) => m.id);

  const matches = await selectInChunks(
    (batch) => client.from('matches').select('id').in('matchday_id', batch),
    matchdayIds,
  );
  const matchIds = matches.map((m) => m.id);

  const lineups = await selectInChunks(
    (batch) => client.from('lineups').select('id').in('match_id', batch),
    matchIds,
  );
  const lineupIds = lineups.map((l) => l.id);

  const lineupPlayersCount = await countInChunks(
    (batch) => client.from('lineup_players').select('id', { count: 'exact', head: true }).in('lineup_id', batch),
    lineupIds,
  );

  const { data: rosters, error: rosterErr } = await client
    .from('rosters')
    .select('id, team_id, player_id')
    .eq('season_id', season.id);
  if (rosterErr) throw rosterErr;

  const rosterTeamIds = new Set((rosters ?? []).map((r) => r.team_id));
  const rosterPlayerIds = new Set((rosters ?? []).map((r) => r.player_id));

  const { data: teamSeasons, error: teamSeasonsErr } = await client
    .from('team_seasons')
    .select('logo_url, jersey_url')
    .eq('season_id', season.id);
  if (teamSeasonsErr) throw teamSeasonsErr;
  const logosCount = (teamSeasons ?? []).filter((t) => t.logo_url).length;
  const jerseysCount = (teamSeasons ?? []).filter((t) => t.jersey_url).length;

  console.log(`Stagione: ${season.label} (${slug})`);
  console.log(`Competizioni: ${competitionIds.length} (${(competitions ?? []).map((c) => c.slug).join(', ')})`);
  console.log(`Giornate: ${matchdayIds.length}`);
  console.log(`Partite: ${matchIds.length}`);
  console.log(`Formazioni (lineups): ${lineupIds.length}`);
  console.log(`Righe lineup_players: ${lineupPlayersCount}`);
  console.log(`Rose: ${rosters?.length ?? 0} righe, ${rosterTeamIds.size} squadre distinte, ${rosterPlayerIds.size} giocatori distinti`);
  console.log(`Branding: ${logosCount}/${teamSeasons?.length ?? 0} loghi, ${jerseysCount}/${teamSeasons?.length ?? 0} maglie`);
}

const seasonSlug = process.argv[2];
if (!seasonSlug) {
  console.error('Uso: tsx verify-import.ts <slug-stagione> (es. 2024-25)');
  process.exit(1);
}

verifyImport(seasonSlug).catch((err: unknown) => {
  console.error(`Verifica ${seasonSlug} fallita:`, err);
  process.exit(1);
});
