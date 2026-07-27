// packages/ingestion/loader/season-repository.ts
//
// Il loader dipende da questa interfaccia, mai direttamente dal client
// Supabase (sezione 6 del piano) — permette di testare upsert/idempotenza
// senza rete né DB reale.
import type { StandingsImport } from '../schema/imports.js';

export interface SeasonRepository {
  upsertStandings(input: StandingsImport): Promise<void>;
  getStandings(competitionSlug: string): Promise<StandingsImport['rows']>;
}

export class InMemorySeasonRepository implements SeasonRepository {
  private store = new Map<string, StandingsImport['rows']>();

  async upsertStandings(input: StandingsImport): Promise<void> {
    // Upsert su chiave naturale (competitionSlug), non insert cieco — coerente
    // con "import idempotenti" di sezione 3: rilanciare due volte non duplica.
    this.store.set(input.competitionSlug, input.rows);
  }

  async getStandings(competitionSlug: string): Promise<StandingsImport['rows']> {
    return this.store.get(competitionSlug) ?? [];
  }
}
