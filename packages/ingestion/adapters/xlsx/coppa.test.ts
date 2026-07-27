// packages/ingestion/adapters/xlsx/coppa.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { XlsxStandingsAdapter } from './standings.js';
import { XlsxCalendarAdapter } from './calendar.js';
import { XlsxLineupAdapter } from './lineup.js';

const STANDINGS = fileURLToPath(
  new URL('./__fixtures__/Classifica_COPPA-LELLE-GIR.-A.xlsx', import.meta.url),
);
const CALENDAR = fileURLToPath(
  new URL('./__fixtures__/Calendario_COPPA-LELLE-FASE-FINALE.xlsx', import.meta.url),
);
const LINEUP = fileURLToPath(
  new URL('./__fixtures__/Formazioni_COPPA_GIRONE_A_1_giornata.xlsx', import.meta.url),
);

describe('Adapter xlsx sui file Coppa 2025-26', () => {
  it('legge la classifica del girone A', async () => {
    const adapter = new XlsxStandingsAdapter('2025-26', 'coppa-girone-a');
    const result = await adapter.parse(STANDINGS);

    expect(result.competitionSlug).toBe('coppa-girone-a');
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('legge il calendario della fase finale', async () => {
    const adapter = new XlsxCalendarAdapter('2025-26', 'coppa-fase-finale');
    const result = await adapter.parse(CALENDAR);

    expect(result.competitionSlug).toBe('coppa-fase-finale');
    expect(result.matchdays.length).toBeGreaterThan(0);
  });

  it('legge le formazioni del girone A', async () => {
    const adapter = new XlsxLineupAdapter('2025-26', 'coppa-girone-a');
    const result = await adapter.parse(LINEUP);

    expect(result.competitionSlug).toBe('coppa-girone-a');
    expect(result.matches.length).toBeGreaterThan(0);
  });
});
