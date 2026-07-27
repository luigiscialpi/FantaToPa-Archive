// packages/ingestion/adapters/types.ts
//
// Contratto comune (Liskov): ogni adapter concreto deve essere intercambiabile
// senza che il loader sappia se sta leggendo un xlsx, un'immagine OCR o un
// vecchio sito — sezione 7 del piano.
export interface SourceAdapter<TImport> {
  canHandle(input: unknown): boolean;
  parse(input: unknown): Promise<TImport>;
}
