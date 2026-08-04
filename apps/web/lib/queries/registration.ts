// apps/web/lib/queries/registration.ts
//
// Query del flusso di registrazione (sezione 9 del piano): squadre libere
// per il form pubblico (via RPC teams_available_for_registration, l'unica
// eccezione leggibile anche da anonimi) e richieste in attesa per il
// pannello admin. Query Supabase mai nei componenti React (AGENTS.md).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';

type TypedSupabaseClient = SupabaseClient<Database>;

export type AvailableTeam = {
  id: string;
  name: string;
};

export async function getTeamsAvailableForRegistration(supabase: TypedSupabaseClient): Promise<AvailableTeam[]> {
  const { data, error } = await supabase.rpc('teams_available_for_registration');

  if (error) {
    throw new Error(`Impossibile leggere le squadre disponibili: ${error.message}`);
  }

  return data
    .map((row) => ({ id: row.id, name: row.canonical_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type PendingRegistrationRequest = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  requestedTeamName: string | null;
  createdAt: string;
};

export async function getPendingRegistrationRequests(
  supabase: TypedSupabaseClient,
): Promise<PendingRegistrationRequest[]> {
  const { data, error } = await supabase
    .from('registration_requests')
    .select('id, first_name, last_name, email, requested_team_id, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Impossibile leggere le richieste di registrazione: ${error.message}`);
  }

  // Stesso pattern "dizionario a parte" di getTeamBranding (team-branding.ts):
  // niente embedding via FK, una seconda query mirata sugli id coinvolti.
  const teamIds = [...new Set(data.map((row) => row.requested_team_id).filter((id): id is string => id !== null))];
  const teamNames = new Map<string, string>();

  if (teamIds.length > 0) {
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, canonical_name')
      .in('id', teamIds);

    if (teamsError) {
      throw new Error(`Impossibile leggere le squadre richieste: ${teamsError.message}`);
    }

    for (const team of teams) {
      teamNames.set(team.id, team.canonical_name);
    }
  }

  return data.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    requestedTeamName: row.requested_team_id ? (teamNames.get(row.requested_team_id) ?? null) : null,
    createdAt: row.created_at,
  }));
}
