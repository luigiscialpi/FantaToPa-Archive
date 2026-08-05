// apps/web/lib/queries/admin-seasons.ts
//
// Query di supporto per la sezione admin "Stagioni": stesso principio di
// getSeasons (AGENTS.md, query mai nei componenti), con in più quante
// squadre hanno già una riga di classifica Campionato — per capire a colpo
// d'occhio quali stagioni (es. le manuali 2004-05→2012-13) sono da
// completare invece di aprirle una per una.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';
import { getSeasons, getCompetitions, type SeasonOption } from './seasons';

type TypedSupabaseClient = SupabaseClient<Database>;

export type SeasonAdminOverview = SeasonOption & {
  campionatoStandingsCount: number;
};

export async function getSeasonsAdminOverview(supabase: TypedSupabaseClient): Promise<SeasonAdminOverview[]> {
  const seasons = await getSeasons(supabase);

  return Promise.all(
    seasons.map(async (season): Promise<SeasonAdminOverview> => {
      const competitions = await getCompetitions(supabase, season.id);
      const campionato = competitions.find((competition) => competition.kindCode === 'campionato');
      if (!campionato) {
        return { ...season, campionatoStandingsCount: 0 };
      }

      const { count, error } = await supabase
        .from('standings')
        .select('id', { count: 'exact', head: true })
        .eq('competition_id', campionato.id);

      if (error) {
        throw new Error(`Impossibile contare la classifica di ${season.slug}: ${error.message}`);
      }

      return { ...season, campionatoStandingsCount: count ?? 0 };
    }),
  );
}
