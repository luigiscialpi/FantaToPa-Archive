// packages/ingestion/lib/normalize-name.ts
//
// Normalizzazione usata per il matching di nomi squadra/giocatore via alias.
// Deve essere deterministica e uguale tra adapter, loader e seed SQL.
export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // rimuove accenti
    .replace(/[^a-z0-9]/g, '')       // rimuove punteggiatura/spazi
    .trim();
}
