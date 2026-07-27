// packages/ingestion/loader/season-repository.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { InMemorySeasonRepository } from './season-repository.js';
import { XlsxStandingsAdapter } from '../adapters/xlsx/standings.js';

// Stessa fixture reale usata in standings.test.ts, nessun path esterno al repo.
const REAL_FILE = fileURLToPath(
  new URL('../adapters/xlsx/__fixtures__/Classifica_CAMPIONATO-FANTATOPA-2025-2026.xlsx', import.meta.url),
);

describe('fetta verticale: xlsx reale -> adapter -> Zod -> repository, zero rete', () => {
  it('importa la classifica reale e la rilancia due volte senza duplicare (idempotenza)', async () => {
    const adapter = new XlsxStandingsAdapter('2025-26', 'campionato');
    const repo = new InMemorySeasonRepository();

    const parsed = await adapter.parse(REAL_FILE);
    await repo.upsertStandings(parsed);
    await repo.upsertStandings(parsed); // rilancio intenzionale

    const stored = await repo.getStandings('campionato');
    expect(stored).toHaveLength(10); // non 20: idempotente
    expect(stored[0]?.teamName).toBe('Monster');
  });
});
