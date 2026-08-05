// apps/web/lib/queries/admin-users.ts
//
// Pannello admin "Utenti": lista di tutti gli utenti registrati con
// squadra assegnata (via RPC admin_list_users, l'unico modo di leggere
// l'email che vive solo in auth.users — mai una query diretta su quello
// schema da qui). Query Supabase mai nei componenti React (AGENTS.md).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';

type TypedSupabaseClient = SupabaseClient<Database>;

export type AdminUserRow = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  teamId: string | null;
  teamName: string | null;
  createdAt: string;
};

export async function getAllUsers(supabase: TypedSupabaseClient): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('admin_list_users');

  if (error) {
    throw new Error(`Impossibile leggere la lista utenti: ${error.message}`);
  }

  return data.map((row) => ({
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    status: row.status,
    teamId: row.team_id,
    teamName: row.team_name,
    createdAt: row.created_at,
  }));
}
