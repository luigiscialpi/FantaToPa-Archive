// packages/ingestion/adapters/xlsx/calendar.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { XlsxCalendarAdapter } from './calendar.js';
import { XlsxStandingsAdapter } from './standings.js';

const REAL_FILE = fileURLToPath(
  new URL('./__fixtures__/Calendario_CAMPIONATO-FANTATOPA-2025-2026.xlsx', import.meta.url),
);
const STANDINGS_FILE = fileURLToPath(
  new URL('./__fixtures__/Classifica_CAMPIONATO-FANTATOPA-2025-2026.xlsx', import.meta.url),
);

describe('XlsxCalendarAdapter, contro il file reale 2025-26', () => {
  it('legge tutte le giornate con 5 partite ciascuna', async () => {
    const adapter = new XlsxCalendarAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    expect(result.matchdays.length).toBeGreaterThan(0);
    for (const md of result.matchdays) {
      expect(md.matches).toHaveLength(5);
    }
  });

  it('normalizza i nomi squadra e produce punti validi (0/1/3)', async () => {
    const adapter = new XlsxCalendarAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    const firstMatch = result.matchdays[0]?.matches[0];
    expect(firstMatch?.homeTeamName).not.toMatch(/ $/);
    expect(firstMatch?.awayTeamName).not.toMatch(/ $/);

    for (const md of result.matchdays) {
      for (const m of md.matches) {
        expect([0, 1, 3]).toContain(m.homeResultPoints);
        expect([0, 1, 3]).toContain(m.awayResultPoints);
        expect(m.homeResultPoints + m.awayResultPoints).toBeGreaterThanOrEqual(2);
        expect(m.homeResultPoints + m.awayResultPoints).toBeLessThanOrEqual(3);
      }
    }
  });

  it('i punti cumulativi delle prime 3 squadre tornano con la classifica', async () => {
    const adapter = new XlsxCalendarAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    const totals = new Map<string, number>();
    for (const md of result.matchdays) {
      for (const m of md.matches) {
        totals.set(m.homeTeamName, (totals.get(m.homeTeamName) ?? 0) + m.homeResultPoints);
        totals.set(m.awayTeamName, (totals.get(m.awayTeamName) ?? 0) + m.awayResultPoints);
      }
    }

    expect(totals.get('Monster')).toBe(70);
    expect(totals.get('Prozalpi S.F.')).toBe(60);
    expect(totals.get('Fantamerda')).toBe(59);
  });

  it('i gol per partita (dal campo "risultato") sommano a Gf/Gs della classifica importata', async () => {
    const calendarAdapter = new XlsxCalendarAdapter('2025-26', 'campionato');
    const calendar = await calendarAdapter.parse(REAL_FILE);

    const standingsAdapter = new XlsxStandingsAdapter('2025-26', 'campionato');
    const standings = await standingsAdapter.parse(STANDINGS_FILE);

    const goalsFor = new Map<string, number>();
    const goalsAgainst = new Map<string, number>();
    for (const md of calendar.matchdays) {
      for (const m of md.matches) {
        goalsFor.set(m.homeTeamName, (goalsFor.get(m.homeTeamName) ?? 0) + m.homeGoals);
        goalsFor.set(m.awayTeamName, (goalsFor.get(m.awayTeamName) ?? 0) + m.awayGoals);
        goalsAgainst.set(m.homeTeamName, (goalsAgainst.get(m.homeTeamName) ?? 0) + m.awayGoals);
        goalsAgainst.set(m.awayTeamName, (goalsAgainst.get(m.awayTeamName) ?? 0) + m.homeGoals);
      }
    }

    expect(standings.rows.length).toBeGreaterThan(0);
    for (const row of standings.rows) {
      expect(goalsFor.get(row.teamName)).toBe(row.goalsFor);
      expect(goalsAgainst.get(row.teamName)).toBe(row.goalsAgainst);
    }
  });
});
