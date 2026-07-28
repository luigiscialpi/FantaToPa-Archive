// apps/web/lib/queries/seasons.ts
//
// Query cross-dominio (stagioni/competizioni): usate sia dal layout
// `stagioni/[season]/layout.tsx` per il selettore persistente in header, sia
// dalle pagine di dominio (Classifica, e in futuro Calendario/Rose/
// Formazioni) per risolvere la stagione/competizione attiva dai parametri
// URL. Vivono qui e non in `classifica.ts` perché non sono specifiche di
// quella pagina — vedi AGENTS.md, query Supabase mai nei componenti React.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';

type TypedSupabaseClient = SupabaseClient<Database>;

export type SeasonOption = {
  id: string;
  slug: string;
  label: string;
};

export type CompetitionOption = {
  id: string;
  slug: string;
  name: string;
};

export async function getSeasons(supabase: TypedSupabaseClient): Promise<SeasonOption[]> {
  const { data, error } = await supabase
    .from('seasons')
    .select('id, slug, label')
    .order('starts_on', { ascending: false });

  if (error) {
    throw new Error(`Impossibile leggere le stagioni: ${error.message}`);
  }

  return data;
}

export async function getCompetitions(supabase: TypedSupabaseClient, seasonId: string): Promise<CompetitionOption[]> {
  const { data, error } = await supabase
    .from('competitions')
    .select('id, slug, name')
    .eq('season_id', seasonId)
    .order('slug', { ascending: true });

  if (error) {
    throw new Error(`Impossibile leggere le competizioni: ${error.message}`);
  }

  return data;
}
