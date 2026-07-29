// apps/web/lib/supabase/server.ts
//
// Client Supabase per Server Component/Server Action: legge la sessione dai
// cookie della richiesta e quindi rispetta la RLS come l'utente autenticato
// (mai la service role key qui, quella resta all'ingestion — vedi AGENTS.md).
//
// Wrappato in cache() di React: layout e page nella stessa render request
// ricevono la stessa istanza — prerequisito per la deduplica delle query
// (getSeasons/getCompetitions wrappate anch'esse in cache(), la cui chiave
// è l'identità dell'argomento supabase).
import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@fantatopa/shared-types/database';
import { getSupabaseEnv } from './env';

export const createClient = cache(async () => {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chiamato da un Server Component: il proxy (proxy.ts) rinnova
          // comunque la sessione ad ogni richiesta, quindi qui è sicuro
          // ignorare l'errore invece di farlo esplodere.
        }
      },
    },
  });
});
