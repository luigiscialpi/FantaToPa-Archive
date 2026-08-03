import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Html2013RosterAdapter } from './roster.js';

const ROSTER_FILE = fileURLToPath(
  new URL('../../../../../docs/Fantacalcio 2013-2014/leghe.fantagazzetta.com/lega-fantato-pa-10th-edition/tutte-le-rose.html', import.meta.url),
);
const TEAM_LIST_FILE = fileURLToPath(
  new URL('../../../../../docs/Fantacalcio 2013-2014/leghe.fantagazzetta.com/lega-fantato-pa-10th-edition/squadre.html', import.meta.url),
);

describe('Html2013RosterAdapter, contro le rose reali 2013-14', () => {
  it('legge le dieci squadre e tutti i 250 giocatori', async () => {
    const adapter = new Html2013RosterAdapter('2013-14', TEAM_LIST_FILE);
    const result = await adapter.parse(ROSTER_FILE);
    const teams = new Set(result.entries.map((entry) => entry.teamName));

    expect(teams).toHaveLength(10);
    expect(result.entries).toHaveLength(250);
    expect(result.teamCredits).toHaveLength(10);
    expect(result.teamCredits.find((credit) => credit.teamName === 'ProZalpi S.F.')).toEqual({
      teamName: 'ProZalpi S.F.',
      creditsRemaining: 26,
    });
  });

  it('conserva ruolo, nome, squadra reale e costo dalla riga sorgente', async () => {
    const adapter = new Html2013RosterAdapter('2013-14');
    const result = await adapter.parse(ROSTER_FILE);
    const brkic = result.entries.find(
      (entry) => entry.teamName === 'CarloParola F.C' && entry.playerName === 'Brkic',
    );

    expect(brkic).toEqual({
      teamName: 'CarloParola F.C',
      playerName: 'Brkic',
      roles: ['P'],
      realTeam: 'UDI',
      cost: 40,
    });
  });
});