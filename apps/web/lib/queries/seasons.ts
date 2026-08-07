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
  // Stagioni con solo un podio/vincitore manuale (nota storica testuale,
  // es. 2004-05→2012-13: nessun mirror sorgente esiste per quelle edizioni)
  // non hanno giornate reali — false qui. Usato per escluderle dal
  // selettore stagione in header e disabilitare il click nella galleria
  // stagioni in home: navigarci mostrerebbe calendario/formazioni/rose vuoti.
  hasSchedule: boolean;
};

export type CompetitionOption = {
  id: string;
  slug: string;
  name: string;
  kindCode: string;
  formatCode: string;
};

export const getSeasons = cache(async (supabase: TypedSupabaseClient): Promise<SeasonOption[]> => {
  const { data, error } = await supabase
    .from('seasons')
    .select('id, slug, label, ends_on')
    // nullsFirst: false come rete di sicurezza — `starts_on` è obbligatorio
    // in creazione (createSeasonAction) proprio per evitare che una stagione
    // senza data nota scavalchi tutte le altre in testa (Postgres mette i
    // NULL per primi in un ORDER BY DESC di default), ma una riga storica
    // creata prima di quel vincolo non deve comunque saltare in cima.
    .order('starts_on', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Impossibile leggere le stagioni: ${error.message}`);
  }

  const { data: competitions, error: competitionsError } = await supabase.from('competitions').select('id, season_id');
  if (competitionsError) {
    throw new Error(`Impossibile leggere le competizioni: ${competitionsError.message}`);
  }

  const competitionIdsBySeason = new Map<string, string[]>();
  for (const competition of competitions) {
    const ids = competitionIdsBySeason.get(competition.season_id) ?? [];
    ids.push(competition.id);
    competitionIdsBySeason.set(competition.season_id, ids);
  }

  // Un head-count per stagione (poche decine in totale, cresce di 1-2 a
  // stagione): niente righe trasferite, niente rischio di troncamento oltre
  // le 1000 righe (AGENTS.md) come invece avverrebbe leggendo tutte le
  // giornate in una sola query.
  const hasScheduleBySeason = new Map<string, boolean>(
    await Promise.all(
      data.map(async (season): Promise<[string, boolean]> => {
        const competitionIds = competitionIdsBySeason.get(season.id) ?? [];
        if (competitionIds.length === 0) return [season.id, false];

        const { count, error: matchdaysError } = await supabase
          .from('matchdays')
          .select('id', { count: 'exact', head: true })
          .in('competition_id', competitionIds);
        if (matchdaysError) {
          throw new Error(`Impossibile leggere le giornate: ${matchdaysError.message}`);
        }
        return [season.id, (count ?? 0) > 0];
      }),
    ),
  );

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    label: row.label,
    endsOn: row.ends_on,
    hasSchedule: hasScheduleBySeason.get(row.id) ?? false,
  }));
});

export const getCompetitions = cache(async (supabase: TypedSupabaseClient, seasonId: string): Promise<CompetitionOption[]> => {
  const { data, error } = await supabase
    .from('competitions')
    .select('id, slug, name, kind_code, format_code')
    .eq('season_id', seasonId)
    .order('slug', { ascending: true });

  if (error) {
    throw new Error(`Impossibile leggere le competizioni: ${error.message}`);
  }

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    kindCode: row.kind_code,
    formatCode: row.format_code,
  }));
});
