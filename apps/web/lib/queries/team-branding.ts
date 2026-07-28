// apps/web/lib/queries/team-branding.ts
//
// Dati di team_seasons (logo/maglia/crediti residui) trasversali a
// Classifica/Calendario/Formazioni/Rose: stesso motivo di seasons.ts, non
// specifico di una singola pagina di dominio (AGENTS.md, query Supabase mai
// nei componenti React).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';

type TypedSupabaseClient = SupabaseClient<Database>;

export type TeamBranding = {
  logoUrl: string | null;
  jerseyUrl: string | null;
  creditsRemaining: number | null;
};

const EMPTY_BRANDING: TeamBranding = { logoUrl: null, jerseyUrl: null, creditsRemaining: null };

export async function getTeamBranding(
  supabase: TypedSupabaseClient,
  seasonId: string,
  teamIds: string[],
): Promise<Map<string, TeamBranding>> {
  const branding = new Map<string, TeamBranding>();
  if (teamIds.length === 0) {
    return branding;
  }

  const { data, error } = await supabase
    .from('team_seasons')
    .select('team_id, logo_url, jersey_url, credits_remaining')
    .eq('season_id', seasonId)
    .in('team_id', teamIds);

  if (error) {
    throw new Error(`Impossibile leggere loghi/maglie: ${error.message}`);
  }

  for (const row of data) {
    branding.set(row.team_id, {
      logoUrl: row.logo_url,
      jerseyUrl: row.jersey_url,
      creditsRemaining: row.credits_remaining,
    });
  }

  return branding;
}

// Non un semplice `branding.get(teamId)`: le squadre senza riga team_seasons
// (branding mai importato) devono comunque poter renderizzare il fallback a
// iniziali, non saltare la riga — vedi Crest.tsx.
export function brandingFor(branding: Map<string, TeamBranding>, teamId: string): TeamBranding {
  return branding.get(teamId) ?? EMPTY_BRANDING;
}
