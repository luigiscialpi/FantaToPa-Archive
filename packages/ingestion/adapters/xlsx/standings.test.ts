// packages/ingestion/adapters/xlsx/standings.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { XlsxStandingsAdapter } from './standings.js';

// File reale della stagione 2025-26 (sezione 2 del piano), copiato come
// fixture di regressione qui accanto al test — nessun path esterno al repo.
const REAL_FILE = fileURLToPath(
  new URL('./__fixtures__/Classifica_CAMPIONATO-FANTATOPA-2025-2026.xlsx', import.meta.url),
);

describe('XlsxStandingsAdapter, contro il file reale 2025-26', () => {
  it('legge tutte e 10 le squadre con Monster primo a 70 punti', async () => {
    const adapter = new XlsxStandingsAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    expect(result.rows).toHaveLength(10);
    expect(result.rows[0]?.teamName).toBe('Monster');
    expect(result.rows[0]?.points).toBe(70);
    expect(result.rows[0]?.totalFantapoints).toBe(2702.5);
  });

  it('normalizza lo spazio finale in "Prozalpi S.F. "', async () => {
    const adapter = new XlsxStandingsAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    const prozalpi = result.rows.find((r) => r.teamName.startsWith('Prozalpi'));
    expect(prozalpi?.teamName).toBe('Prozalpi S.F.'); // senza spazio finale
  });

  it('i punti tornano con lo scoring 3/1/0 verificato in sezione 6 del piano', async () => {
    const adapter = new XlsxStandingsAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    for (const row of result.rows) {
      expect(row.won * 3 + row.drawn * 1).toBe(row.points);
    }
  });
});
