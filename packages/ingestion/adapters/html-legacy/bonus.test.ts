// packages/ingestion/adapters/html-legacy/bonus.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { FlatHtmlBonusAdapter } from './bonus.js';

// Nome file "formazioni-1.html" ma giornata REALE 38 (letta da
// <input id="gselected">, non dal suffisso del nome file) — stesso file
// fixture già usato da lineup.test.ts, stessa trappola documentata in testa
// a lineup.ts.
const REAL_FILE = fileURLToPath(new URL('./__fixtures__/2017-18/formazioni-1.html', import.meta.url));

describe('FlatHtmlBonusAdapter, contro il file reale 2017-18 (formazioni-1.html = giornata 38)', () => {
  it('legge la giornata reale da "gselected", non dal nome file', async () => {
    const adapter = new FlatHtmlBonusAdapter('2017-18', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    expect(result.seasonSlug).toBe('2017-18');
    expect(result.competitionSlug).toBe('campionato');
    expect(result.matchdayNumber).toBe(38);
  });

  it('legge un numero di giocatori coerente con 4 box-match (titolari+panchina)', async () => {
    const adapter = new FlatHtmlBonusAdapter('2017-18', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    // Soglia larga (non un conteggio esatto): basta escludere che il parser
    // abbia letto solo il template o si sia fermato a metà file.
    expect(result.players.length).toBeGreaterThan(100);
  });

  it('assegna i bonus/malus corretti, incluso l\'ordine e le ripetizioni dello stesso codice', async () => {
    const adapter = new FlatHtmlBonusAdapter('2017-18', 'campionato');
    const result = await adapter.parse(REAL_FILE);
    const byName = new Map(result.players.map((p) => [p.playerName, p.bonusCodes]));

    expect(byName.get('Donnarumma G')).toEqual(['gol_subito']);
    // Belec ha subito 3 gol nella stessa partita: 3 icone "gol subito"
    // ripetute nella fonte, non deduplicate.
    expect(byName.get('Belec')).toEqual(['gol_subito', 'gol_subito', 'gol_subito']);
    // Calhanoglu: ammonito, un gol e due assist nella stessa partita.
    expect(byName.get('Calhanoglu')).toEqual(['ammonizione', 'gol_fatto', 'assist', 'assist']);
  });

  it('riconosce "assist da fermo" come bonus_kind dedicato (assente nella fonte 2025-26)', async () => {
    const adapter = new FlatHtmlBonusAdapter('2017-18', 'campionato');
    const result = await adapter.parse(REAL_FILE);
    const byName = new Map(result.players.map((p) => [p.playerName, p.bonusCodes]));

    expect(byName.get('Brozovic')).toEqual(['ammonizione', 'assist_fermo']);
  });

  it('non assegna bonus a chi non ne ha ricevuti', async () => {
    const adapter = new FlatHtmlBonusAdapter('2017-18', 'campionato');
    const result = await adapter.parse(REAL_FILE);
    const byName = new Map(result.players.map((p) => [p.playerName, p.bonusCodes]));

    expect(byName.get('Samir')).toEqual([]);
  });
});
