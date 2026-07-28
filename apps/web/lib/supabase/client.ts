// apps/web/lib/supabase/client.ts
//
// Client Supabase per Client Component (es. form di login). Stessa anon key
// del client server, esposta nel bundle browser di proposito: la sicurezza
// sta nella RLS, non nella segretezza di questa chiave.
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@fantatopa/shared-types/database';
import { getSupabaseEnv } from './env';

export function createClient() {
  const { url, anonKey } = getSupabaseEnv();

  return createBrowserClient<Database>(url, anonKey);
}
