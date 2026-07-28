// apps/web/lib/auth/session.ts
//
// Stato di sessione + profilo per il gate d'accesso nel layout protetto.
// getClaims() (non getUser()/getSession()) perché verifica la firma del JWT
// — con le chiavi di firma asimmetriche del progetto lo fa localmente,
// senza round-trip di rete (vedi doc Supabase SSR, sezione "Danger").
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';
import { createClient } from '../supabase/server';

export type SessionProfile = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  teamId: string | null;
};

export type SessionState = { kind: 'anonimo' } | { kind: 'autenticato'; profile: SessionProfile };

async function loadProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  email: string | null,
): Promise<SessionProfile> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, status, team_id')
    .eq('id', userId)
    .maybeSingle();

  return {
    userId,
    email,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    // Se manca la riga profiles (non dovrebbe succedere: il trigger
    // handle_new_user la crea sempre alla registrazione, vedi migrazione
    // schema_iniziale), il fallback più sicuro è "nessun accesso ai dati
    // di lega", non un errore che blocca la pagina.
    role: profile?.role ?? 'user',
    status: profile?.status ?? 'pending',
    teamId: profile?.team_id ?? null,
  };
}

export async function getSessionState(): Promise<SessionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    return { kind: 'anonimo' };
  }

  const profile = await loadProfile(supabase, data.claims.sub, data.claims.email ?? null);

  return { kind: 'autenticato', profile };
}

// Rispecchia la funzione Postgres can_read_league_data() usata nelle policy
// RLS (schema_iniziale.sql): stessa logica, ma qui serve solo per decidere
// cosa mostrare in UI — l'accesso vero ai dati resta comunque garantito (o
// negato) dalla RLS lato database, non da questo controllo lato client.
export function canReadLeagueData(profile: SessionProfile): boolean {
  return profile.role === 'admin' || profile.status === 'approved';
}
