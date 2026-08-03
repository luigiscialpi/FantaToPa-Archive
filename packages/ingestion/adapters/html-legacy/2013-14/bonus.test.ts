import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Html2013BonusAdapter } from './bonus.js';

const BONUS_FILE = fileURLToPath(
  new URL('../../../../../docs/Fantacalcio 2013-2014/leghe.fantagazzetta.com/lega-fantato-pa-10th-edition/formazioni.html', import.meta.url),
);

describe('Html2013BonusAdapter, contro le formazioni reali 2013-14', () => {
  it('legge la giornata interna e deduplica gli stessi giocatori tra le formazioni', async () => {
    const adapter = new Html2013BonusAdapter('2013-14', 'coppa-fase-finale');
    const result = await adapter.parse(BONUS_FILE);
    const byName = new Map(result.players.map((player) => [player.playerName, player.bonusCodes]));

    expect(result.matchdayNumber).toBe(5);
    expect(result.players.length).toBeGreaterThan(30);
    expect(byName.get('Immobile')).toEqual(['ammonizione', 'gol_fatto']);
    expect(byName.get('Neto')).toEqual(['ammonizione', 'gol_subito', 'gol_subito', 'gol_subito']);
  });

  it('ignora gli indicatori visuali non rappresentati in bonus_kinds', async () => {
    const adapter = new Html2013BonusAdapter('2013-14', 'coppa-fase-finale');
    const result = await adapter.parse(BONUS_FILE);
    const byName = new Map(result.players.map((player) => [player.playerName, player.bonusCodes]));

    expect(byName.get('Cerci')).toEqual(['ammonizione', 'gol_fatto']);
    expect(byName.get('Abate')).toEqual([]);
    expect(byName.get('Toni')).toEqual(['rigore_segnato']);
  });
});