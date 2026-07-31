// packages/ingestion/scripts/seed-team-registry.ts
//
// Seed UNA TANTUM del registro squadre (identità persistenti + alias) nel
// database — non fa parte del flusso di import-season.ts, che dopo questo
// seed si limita a risolvere i nomi contro teams/team_aliases già popolate.
// Da rilanciare solo quando team-registry.local.json cambia (nuova squadra,
// nuovo alias scoperto): upsertTeams è idempotente, sicuro da rieseguire.
//
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/seed-team-registry.ts
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import { loadTeamRegistry } from './team-registry.js';

async function main(): Promise<void> {
  const registry = await loadTeamRegistry();
  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);

  await repo.upsertTeams(registry.map((t) => ({ name: t.canonicalName, aliases: t.aliases })));
  console.log(`Registro squadre seminato: ${registry.length} squadre.`);
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
