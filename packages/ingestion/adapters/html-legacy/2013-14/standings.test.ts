import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Html2013StandingsAdapter } from './standings.js';

const CLASSIFICA_FILE = fileURLToPath(new URL('../__fixtures__/2012-13/classifica.html', import.meta.url));

describe('Html2013StandingsAdapter, contro la classifica reale Campionato 2012-13', () => {
  it('legge le 10 righe in ordine di posizione con tutte le colonne', async () => {
    const adapter = new Html2013StandingsAdapter('2012-13', 'campionato');
    const result = await adapter.parse(CLASSIFICA_FILE);

    expect(result.rows).toHaveLength(10);
    expect(result.rows.map((row) => row.teamName)).toEqual([
      'pierpaologranata',
      'Skajahnny f.c 2004',
      'A.C. Smokingbiancoleite',
      'Goliardic F.C.',
      'Nemesis 08 F.C',
      'ProZalpi S.F.',
      'Real Cocu 2003 F.C.',
      'CarloParola F.C',
      'C. F. Igli Tare 2003',
      'Steaua Ste',
    ]);
    expect(result.rows.map((row) => row.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('estrae correttamente V/N/P/gol/punti per la prima e l\'ultima riga', async () => {
    const adapter = new Html2013StandingsAdapter('2012-13', 'campionato');
    const result = await adapter.parse(CLASSIFICA_FILE);

    expect(result.rows[0]).toEqual({
      teamName: 'pierpaologranata',
      position: 1,
      points: 72,
      played: 38,
      won: 21,
      drawn: 9,
      lost: 8,
      goalsFor: 58,
      goalsAgainst: 44,
      totalFantapoints: 2714,
    });
    expect(result.rows[9]).toEqual({
      teamName: 'Steaua Ste',
      position: 10,
      points: 36,
      played: 38,
      won: 8,
      drawn: 12,
      lost: 18,
      goalsFor: 40,
      goalsAgainst: 49,
      totalFantapoints: 2647.5,
    });
  });
});
