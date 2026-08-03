import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Html2013LineupAdapter } from './lineup.js';

const LINEUP_FILE = fileURLToPath(new URL('../__fixtures__/2013-14/formazioni-1.html', import.meta.url));

describe('Html2013LineupAdapter, contro una formazione reale 2013-14', () => {
  it('legge giornata, partita, moduli e 11 titolari per lato', async () => {
    const adapter = new Html2013LineupAdapter('2013-14', 'coppa-fase-finale');
    const result = await adapter.parse(LINEUP_FILE);
    const match = result.matches[0]!;

    expect(result.matchdayNumber).toBe(1);
    expect(result.matches).toHaveLength(1);
    expect(match.home.teamName).toBe('Nemesis 08 F.C');
    expect(match.away?.teamName).toBe('Steaua Ste');
    expect(match.home.formation).toBe('4-3-3');
    expect(match.away?.formation).toBe('3-4-3');
    expect(match.home.players.filter((player) => player.slot === 'titolare')).toHaveLength(11);
    expect(match.away?.players.filter((player) => player.slot === 'titolare')).toHaveLength(11);
  });

  it('legge panchina, conteggio nel totale, footer e timestamp ISO', async () => {
    const adapter = new Html2013LineupAdapter('2013-14', 'coppa-fase-finale');
    const result = await adapter.parse(LINEUP_FILE);
    const home = result.matches[0]!.home;
    const pasqual = home.players.find((player) => player.playerName === 'Pasqual');
    const izco = home.players.find((player) => player.playerName === 'Izco');

    expect(home.players.filter((player) => player.slot === 'panchina')).toHaveLength(6);
    expect(pasqual?.voto).toBeNull();
    expect(pasqual?.countsForTotal).toBe(false);
    expect(izco?.slot).toBe('panchina');
    expect(izco?.countsForTotal).toBe(true);
    expect(home.defenseModifier).toBe(2);
    expect(home.fieldAdvantage).toBe(1);
    expect(home.total).toBe(82);
    expect(home.submittedAt).toBe('2014-02-25T10:40:18');
  });
});