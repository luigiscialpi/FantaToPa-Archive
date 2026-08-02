// packages/ingestion/adapters/html-legacy/lineup.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { FlatHtmlLineupAdapter } from './lineup.js';

// Nome file "formazioni-1.html" ma giornata REALE 38 (letta da
// <input id="gselected">, non dal suffisso del nome file) — vedi trappola
// documentata in testa a lineup.ts.
const REAL_FILE = fileURLToPath(new URL('./__fixtures__/2017-18/formazioni-1.html', import.meta.url));

describe('FlatHtmlLineupAdapter, contro il file reale 2017-18 (formazioni-1.html = giornata 38)', () => {
  it('legge la giornata reale da "gselected", non dal nome file', async () => {
    const adapter = new FlatHtmlLineupAdapter('2017-18', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    expect(result.matchdayNumber).toBe(38);
    expect(result.matchdayLabel).toContain('38');
  });

  it('legge 4 box-match, ognuno con titolari home/away e formazione/totale validi', async () => {
    const adapter = new FlatHtmlLineupAdapter('2017-18', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    expect(result.matches).toHaveLength(4);
    for (const match of result.matches) {
      expect(match.home.teamName).toBeTruthy();
      expect(match.away?.teamName).toBeTruthy();
      expect(match.home.formation).toMatch(/^\d-\d-\d$/);
      expect(match.away?.formation).toMatch(/^\d-\d-\d$/);
      expect(match.home.total).toBeGreaterThan(0);
      expect(match.away?.total).toBeGreaterThan(0);

      const homeStarters = match.home.players.filter((p) => p.slot === 'titolare');
      const awayStarters = (match.away?.players ?? []).filter((p) => p.slot === 'titolare');
      expect(homeStarters).toHaveLength(11);
      expect(awayStarters).toHaveLength(11);
    }
  });

  it('legge countsForTotal dalla classe "bold" della cella fantavoto, non da voto/slot', async () => {
    const adapter = new FlatHtmlLineupAdapter('2017-18', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    const allPlayers = result.matches.flatMap((m) => [...m.home.players, ...(m.away?.players ?? [])]);

    // Tutti i titolari contano per il totale, anche quelli senza voto (riga "bnc").
    const starters = allPlayers.filter((p) => p.slot === 'titolare');
    expect(starters.every((p) => p.countsForTotal)).toBe(true);

    // Tra i panchinari esistono sia chi conta (subentrato) sia chi non conta.
    const bench = allPlayers.filter((p) => p.slot === 'panchina');
    expect(bench.some((p) => p.countsForTotal)).toBe(true);
    expect(bench.some((p) => !p.countsForTotal)).toBe(true);
  });

  it('legge submittedVia/submittedAt quando presenti nel footer', async () => {
    const adapter = new FlatHtmlLineupAdapter('2017-18', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    const withSubmission = result.matches.find((m) => m.home.submittedAt);
    expect(withSubmission).toBeDefined();
    // Convertito in ISO al momento del parsing (la fonte è "dd/mm/yyyy
    // hh:mm:ss", ambiguo/non valido per Postgres se lasciato raw).
    expect(withSubmission?.home.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it('legge defenseModifier/fieldAdvantage come 0 quando la riga opzionale è assente', async () => {
    const adapter = new FlatHtmlLineupAdapter('2017-18', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    for (const match of result.matches) {
      expect(typeof match.home.defenseModifier).toBe('number');
      expect(typeof match.home.fieldAdvantage).toBe('number');
      expect(typeof match.away?.defenseModifier).toBe('number');
      expect(typeof match.away?.fieldAdvantage).toBe('number');
    }
  });
});
