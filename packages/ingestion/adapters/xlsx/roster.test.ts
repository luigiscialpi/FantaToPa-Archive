// packages/ingestion/adapters/xlsx/roster.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { XlsxRosterAdapter } from './roster.js';

const REAL_FILE = fileURLToPath(
  new URL('./__fixtures__/Rose_fantatopa.xlsx', import.meta.url),
);

describe('XlsxRosterAdapter, contro il file reale 2025-26', () => {
  it('legge tutte e 10 le squadre', async () => {
    const adapter = new XlsxRosterAdapter('2025-26');
    const result = await adapter.parse(REAL_FILE);

    const teamNames = [...new Set(result.entries.map((e) => e.teamName))];
    expect(teamNames).toHaveLength(10);
  });

  it('normalizza i nomi squadra con spazio finale (es. "Prozalpi S.F. ")', async () => {
    const adapter = new XlsxRosterAdapter('2025-26');
    const result = await adapter.parse(REAL_FILE);

    const teamNames = [...new Set(result.entries.map((e) => e.teamName))];
    expect(teamNames).not.toContain('Prozalpi S.F. ');
    expect(teamNames).toContain('Prozalpi S.F.');
  });

  it('trova almeno 20 giocatori a squadra e splitta i ruoli multipli', async () => {
    const adapter = new XlsxRosterAdapter('2025-26');
    const result = await adapter.parse(REAL_FILE);

    const byTeam = new Map<string, number>();
    for (const entry of result.entries) {
      byTeam.set(entry.teamName, (byTeam.get(entry.teamName) ?? 0) + 1);
    }
    for (const count of byTeam.values()) {
      expect(count).toBeGreaterThanOrEqual(20);
    }

    const multiRole = result.entries.find((e) => e.roles.length > 1);
    expect(multiRole).toBeDefined();
  });
});
