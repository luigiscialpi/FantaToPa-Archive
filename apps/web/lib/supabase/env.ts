// apps/web/lib/supabase/env.ts
//
// Lette una sola volta da entrambi i client (browser e server): stesse
// variabili già usate dall'ingestion (.env.local), NEXT_PUBLIC_ perché il
// client browser ne ha bisogno nel bundle. La sicurezza sta nella RLS, non
// nella segretezza della anon key (AGENTS.md: la service role key invece non
// deve mai comparire qui).
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Variabili d'ambiente mancanti: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY sono richieste.",
    );
  }

  return { url, anonKey };
}
