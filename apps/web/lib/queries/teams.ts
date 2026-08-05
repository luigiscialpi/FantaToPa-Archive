// apps/web/lib/queries/teams.ts
//
// Elenco completo delle squadre (identità persistente, non scoped a una
// stagione): usato dal pannello admin Utenti (riassegnazione squadra) e
// dalla futura pagina Profilo Squadra (selettore di qualunque squadra a
// DB). Query Supabase mai nei componenti React (AGENTS.md).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';

type TypedSupabaseClient = SupabaseClient<Database>;

export type TeamOption = {
  id: string;
  slug: string;
  name: string;
};

export async function getAllTeams(supabase: TypedSupabaseClient): Promise<TeamOption[]> {
  const { data, error } = await supabase.from('teams').select('id, slug, canonical_name').order('canonical_name', { ascending: true });

  if (error) {
    throw new Error(`Impossibile leggere le squadre: ${error.message}`);
  }

  return data.map((row) => ({ id: row.id, slug: row.slug, name: row.canonical_name }));
}
