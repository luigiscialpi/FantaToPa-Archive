// apps/web/lib/queries/seasons.ts
//
// Query cross-dominio (stagioni/competizioni): usate sia dal layout
// `stagioni/[season]/layout.tsx` per il selettore persistente in header, sia
// dalle pagine di dominio (Classifica, e in futuro Calendario/Rose/
// Formazioni) per risolvere la stagione/competizione attiva dai parametri
// URL. Vivono qui e non in `classifica.ts` perché non sono specifiche di
// quella pagina — vedi AGENTS.md, query Supabase mai nei componenti React.
//
// Wrappate in cache() di React: layout e page invocano entrambe getSeasons/
// getCompetitions nella stessa render request — cache() garantisce che la
// query parta una volta sola (la cache è per-request, non cross-utente,
// quindi rispetta la RLS).
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';

type TypedSupabaseClient = SupabaseClient<Database>;

export type SeasonOption = {
  id: string;
  slug: string;
  label: string;
  endsOn: string | null;
};

export type CompetitionOption = {
  id: string;
  slug: string;
  name: string;
  kindCode: string;
};

export const getSeasons = cache(async (supabase: TypedSupabaseClient): Promise<SeasonOption[]> => {
  const { data, error } = await supabase
    .from('seasons')
    .select('id, slug, label, ends_on')
    .order('starts_on', { ascending: false });

  if (error) {
    throw new Error(`Impossibile leggere le stagioni: ${error.message}`);
  }

  return data.map((row) => ({ id: row.id, slug: row.slug, label: row.label, endsOn: row.ends_on }));
});

export const getCompetitions = cache(async (supabase: TypedSupabaseClient, seasonId: string): Promise<CompetitionOption[]> => {
  const { data, error } = await supabase
    .from('competitions')
    .select('id, slug, name, kind_code')
    .eq('season_id', seasonId)
    .order('slug', { ascending: true });

  if (error) {
    throw new Error(`Impossibile leggere le competizioni: ${error.message}`);
  }

  return data.map((row) => ({ id: row.id, slug: row.slug, name: row.name, kindCode: row.kind_code }));
});
