// apps/web/lib/queries/home-cache.ts
//
// Cache cross-richiesta (sopravvive a diverse navigazioni/utenti, a
// differenza di cache() di React che scade a fine singola richiesta) per le
// query più costose del pannello squadra in Home (TeamPanelSection,
// RosterStatsCards). Sicura perché ogni tabella coinvolta ha RLS uniforme
// "qualunque membro approvato legge tutto" (can_read_league_data() in
// supabase/migrations/20260726000000_schema_iniziale.sql, nessuna riga
// filtrata diversamente per team/ruolo) — il risultato non dipende da CHI
// lo richiede, solo dal teamId, quindi condividerlo fra utenti è corretto.
// Il gate d'accesso resta comunque per-richiesta: (protected)/layout.tsx
// verifica la sessione PRIMA di rendere le pagine che chiamano queste
// funzioni, un cache-hit non salta quel controllo.
import { unstable_cache } from 'next/cache';

export const HOME_STATS_TAG = 'home-team-stats';

// Rete di sicurezza se lo script di ingestion non riesce a chiamare
// /api/internal/revalidate-home-stats (es. sito non raggiungibile in quel
// momento): entro un'ora il dato si aggiorna comunque da solo.
const HOME_STATS_REVALIDATE_SECONDS = 60 * 60;

function teamStatsTag(teamId: string): string {
  return `${HOME_STATS_TAG}:${teamId}`;
}

// `teamId` è `null` per le query non specifiche di una squadra (es.
// getAllTimeTitleCounts, che ritorna la mappa di TUTTE le squadre in una
// volta): quella entry va invalidata dal tag globale, non da uno per team.
//
// `fn` deve ritornare solo tipi JSON-safe (array/oggetti/stringhe/numeri/
// null): unstable_cache serializza il valore, quindi una Map/Set/Date torna
// un oggetto vuoto dopo il round-trip (visto un crash reale in produzione
// con getAllTimeTitleCounts) — se la query sorgente ritorna una Map,
// convertirla in array di entries prima di passarla qui e ricostruirla dopo.
export function cachedHomeStat<T>(name: string, teamId: string | null, fn: () => Promise<T>): Promise<T> {
  return unstable_cache(fn, ['home-stat', name, teamId ?? 'all'], {
    tags: teamId ? [HOME_STATS_TAG, teamStatsTag(teamId)] : [HOME_STATS_TAG],
    revalidate: HOME_STATS_REVALIDATE_SECONDS,
  })();
}
