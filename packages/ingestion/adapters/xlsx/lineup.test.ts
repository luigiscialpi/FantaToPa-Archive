// packages/ingestion/adapters/xlsx/lineup.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { XlsxLineupAdapter } from './lineup.js';

const REAL_FILE = fileURLToPath(
  new URL('./__fixtures__/Formazioni_fantatopa_1_giornata.xlsx', import.meta.url),
);

describe('XlsxLineupAdapter, contro il file reale 2025-26 (giornata 1)', () => {
  it('legge 5 partite con 11 titolari ciascuno', async () => {
    const adapter = new XlsxLineupAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    expect(result.matchdayNumber).toBe(1);
    expect(result.matches).toHaveLength(5);

    for (const match of result.matches) {
      const homeStarters = match.home.players.filter((p) => p.slot === 'titolare');
      const awayStarters = match.away.players.filter((p) => p.slot === 'titolare');
      expect(homeStarters).toHaveLength(11);
      expect(awayStarters).toHaveLength(11);
    }
  });

  it('normalizza i nomi squadra e legge formazione/totale', async () => {
    const adapter = new XlsxLineupAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    const firstMatch = result.matches[0];
    expect(firstMatch?.home.teamName).not.toMatch(/ $/);
    expect(firstMatch?.away.teamName).not.toMatch(/ $/);
    expect(firstMatch?.home.formation).toBeTruthy();
    expect(firstMatch?.away.formation).toBeTruthy();
    expect(firstMatch?.home.total).toBeGreaterThan(0);
    expect(firstMatch?.away.total).toBeGreaterThan(0);
  });

  it('splitta ruoli multipli e converte "-"/"sv" in voto null', async () => {
    const adapter = new XlsxLineupAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    const multiRole = result.matches.flatMap((m) => [...m.home.players, ...m.away.players]).find((p) => p.roles.length > 1);
    expect(multiRole).toBeDefined();

    const nullVoto = result.matches.flatMap((m) => [...m.home.players, ...m.away.players]).find((p) => p.voto === null);
    expect(nullVoto).toBeDefined();
  });
});
