// packages/ingestion/lib/supabase-client.ts
//
// Client Supabase con service role key, da usare SOLO negli script di ingestion
// server-side (AGENTS.md: mai nel bundle browser).
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database.js';

export function createIngestionClient(): ReturnType<typeof createClient<Database>> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Variabili d\'ambiente mancanti: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono richieste per l\'ingestion.',
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
