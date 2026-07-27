// packages/ingestion/loader/season-repository.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { InMemorySeasonRepository } from './season-repository.js';
import { XlsxStandingsAdapter } from '../adapters/xlsx/standings.js';

// Stessa fixture reale usata in standings.test.ts, nessun path esterno al repo.
const REAL_FILE = fileURLToPath(
  new URL('../adapters/xlsx/__fixtures__/Classifica_CAMPIONATO-FANTATOPA-2025-2026.xlsx', import.meta.url),
);

describe('InMemorySeasonRepository', () => {
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

  it('risolve i nomi squadra tramite alias normalizzati', async () => {
    const repo = new InMemorySeasonRepository();
    await repo.upsertTeams([
      { name: 'Prozalpi S.F.', aliases: ['Pro Zalpi S.F.'] },
    ]);

    const idCanonical = await repo.resolveTeamId('Prozalpi S.F.');
    const idAlias = await repo.resolveTeamId('Pro Zalpi S.F.');
    const idUnknown = await repo.resolveTeamId('Squadra Inesistente');

    expect(idCanonical).toBeDefined();
    expect(idAlias).toBe(idCanonical);
    expect(idUnknown).toBeUndefined();
  });

  it('normalizza spazi e punteggiatura nella risoluzione alias', async () => {
    const repo = new InMemorySeasonRepository();
    await repo.upsertTeams([{ name: 'MR EKO - C&W F.C.' }]);

    const id = await repo.resolveTeamId('MR EKO - C&W F.C. ');
    expect(id).toBeDefined();
  });
});
