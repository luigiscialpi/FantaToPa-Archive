// packages/ingestion/loader/season-repository.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { InMemorySeasonRepository } from './season-repository.js';
import { XlsxStandingsAdapter } from '../adapters/xlsx/standings.js';
import { XlsxRosterAdapter } from '../adapters/xlsx/roster.js';
import { HtmlVotiBonusAdapter } from '../adapters/html-voti/bonus.js';

// Stessa fixture reale usata in standings.test.ts, nessun path esterno al repo.
const REAL_FILE = fileURLToPath(
  new URL('../adapters/xlsx/__fixtures__/Classifica_CAMPIONATO-FANTATOPA-2025-2026.xlsx', import.meta.url),
);
const ROSTER_FILE = fileURLToPath(new URL('../adapters/xlsx/__fixtures__/Rose_fantatopa.xlsx', import.meta.url));
const BONUS_FILE = fileURLToPath(new URL('../adapters/html-voti/__fixtures__/001.html', import.meta.url));

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

  it('salva il nome usato da una squadra in una specifica stagione, distinto dal nome canonico', async () => {
    const repo = new InMemorySeasonRepository();
    await repo.upsertTeams([{ name: 'Los Cientoquattros Hertha Rallo', aliases: ['Hertha Rallo'] }]);
    const teamId = await repo.resolveTeamId('Hertha Rallo');
    if (!teamId) throw new Error('team non risolto');

    await repo.upsertTeamSeasonDisplayName(teamId, 'season-2020-21', 'Hertha Rallo');
    await repo.upsertTeamSeasonDisplayName(teamId, 'season-2025-26', 'Los Cientoquattros Hertha Rallo');

    expect(await repo.getTeamSeasonDisplayName(teamId, 'season-2020-21')).toBe('Hertha Rallo');
    expect(await repo.getTeamSeasonDisplayName(teamId, 'season-2025-26')).toBe('Los Cientoquattros Hertha Rallo');
  });

  it('importa i crediti residui dalla rosa reale e li rilancia senza duplicare (idempotenza)', async () => {
    const adapter = new XlsxRosterAdapter('2025-26');
    const repo = new InMemorySeasonRepository();

    const parsed = await adapter.parse(ROSTER_FILE);
    await repo.upsertRoster(parsed);
    await repo.upsertRoster(parsed); // rilancio intenzionale

    const credits = await repo.getTeamCredits('2025-26');
    expect(credits).toHaveLength(10);
  });

  it('importa i bonus/malus reali di una giornata e li rilancia senza duplicare (idempotenza)', async () => {
    const adapter = new HtmlVotiBonusAdapter('2025-26', 'campionato');
    const repo = new InMemorySeasonRepository();

    const parsed = await adapter.parse(BONUS_FILE);
    await repo.upsertMatchdayBonuses(parsed);
    await repo.upsertMatchdayBonuses(parsed); // rilancio intenzionale

    const stored = await repo.getMatchdayBonuses('campionato', 1);
    expect(stored).toHaveLength(parsed.players.length); // non raddoppiato

    const meret = stored.find((p) => p.playerName === 'Meret');
    expect(meret?.bonusCodes).toEqual(['portiere_imbattuto']);
  });
});
