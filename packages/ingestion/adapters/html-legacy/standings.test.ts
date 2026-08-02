// packages/ingestion/adapters/html-legacy/standings.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { FlatHtmlStandingsAdapter } from './standings.js';

const CAMPIONATO_FILE = fileURLToPath(
  new URL('./__fixtures__/2017-18/classifica-campionato.html', import.meta.url),
);
const GIRONE_A_FILE = fileURLToPath(new URL('./__fixtures__/2017-18/classifica-girone-a.html', import.meta.url));

describe('FlatHtmlStandingsAdapter, contro i file reali 2017-18', () => {
  it('legge il layout "full" (9 colonne) del Campionato', async () => {
    const adapter = new FlatHtmlStandingsAdapter('2017-18', 'campionato');
    const result = await adapter.parse(CAMPIONATO_FILE);

    expect(result.rows).toHaveLength(8);
    const first = result.rows.find((r) => r.position === 1);
    expect(first?.teamName).toBe('Biancoceleste Athletic Club');
    expect(first?.played).toBe(38);
    expect(first?.won).toBe(23);
    expect(first?.drawn).toBe(10);
    expect(first?.lost).toBe(5);
    expect(first?.goalsFor).toBe(80);
    expect(first?.goalsAgainst).toBe(56);
    expect(first?.points).toBe(79);
    expect(first?.totalFantapoints).toBe(2846);
  });

  it('legge il layout "reduced" (3 colonne) di un Girone Coppa, senza campi assenti dalla fonte', async () => {
    const adapter = new FlatHtmlStandingsAdapter('2017-18', 'coppa-girone-a');
    const result = await adapter.parse(GIRONE_A_FILE);

    expect(result.rows).toHaveLength(4);
    const first = result.rows.find((r) => r.position === 1);
    expect(first?.teamName).toBe('Nemesis 08 FC');
    expect(first?.points).toBe(12);
    expect(first?.totalFantapoints).toBe(313);
    // Il Girone ha solo 3 colonne (pos/nome, pt., g.): played è presente ma
    // vittorie/pareggi/sconfitte/gol non esistono nella fonte, non devono
    // comparire come 0 fittizio.
    expect(first?.played).toBe(4);
    expect(first?.won).toBeUndefined();
    expect(first?.goalsFor).toBeUndefined();
  });

  it('scarta la colonna "dr" (differenza reti, derivabile) senza fallire', async () => {
    // La colonna "dr" è presente nell'header del Campionato ma non nello
    // schema (StandingsImport non la modella, si deriva da gf-gs): il test
    // principale sopra già passa attraverso questa colonna, qui verifichiamo
    // solo che nessun campo spurio "dr" compaia nella riga risultante.
    const adapter = new FlatHtmlStandingsAdapter('2017-18', 'campionato');
    const result = await adapter.parse(CAMPIONATO_FILE);

    for (const row of result.rows) {
      expect(row).not.toHaveProperty('dr');
    }
  });
});
