// packages/ingestion/adapters/html-legacy/calendar.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { FlatHtmlCalendarAdapter, FlatHtmlFinalMatchAdapter } from './calendar.js';

const CAMPIONATO_FILE = fileURLToPath(
  new URL('./__fixtures__/2017-18/calendario-campionato.html', import.meta.url),
);
const SECONDA_FASE_FILE = fileURLToPath(
  new URL('./__fixtures__/2017-18/final-match-seconda-fase.html', import.meta.url),
);

describe('FlatHtmlCalendarAdapter, contro il calendario reale 2017-18 (Campionato)', () => {
  it('legge tutte le 38 giornate con 4 partite ciascuna', async () => {
    const adapter = new FlatHtmlCalendarAdapter('2017-18', 'campionato');
    const result = await adapter.parse(CAMPIONATO_FILE);

    expect(result.matchdays).toHaveLength(38);
    for (const matchday of result.matchdays) {
      expect(matchday.matches).toHaveLength(4);
    }
  });

  it('legge la prima giornata con punteggi/gol/punti classifica corretti', async () => {
    const adapter = new FlatHtmlCalendarAdapter('2017-18', 'campionato');
    const result = await adapter.parse(CAMPIONATO_FILE);

    const firstMatchday = result.matchdays.find((m) => m.number === 1);
    const match = firstMatchday?.matches[0];
    expect(match?.homeTeamName).toBe('BBSATLPR Bologna AC 17');
    expect(match?.awayTeamName).toBe('Real Cocu 2003 FC');
    expect(match?.homeScore).toBe(81.5);
    expect(match?.awayScore).toBe(77);
    expect(match?.homeGoals).toBe(3);
    expect(match?.awayGoals).toBe(2);
    expect(match?.homeResultPoints).toBe(3);
    expect(match?.awayResultPoints).toBe(0);
  });

  it('assegna 1 punto per parte in caso di pareggio', async () => {
    const adapter = new FlatHtmlCalendarAdapter('2017-18', 'campionato');
    const result = await adapter.parse(CAMPIONATO_FILE);

    const draw = result.matchdays.flatMap((m) => m.matches).find((m) => m.homeGoals === m.awayGoals);
    expect(draw).toBeDefined();
    expect(draw?.homeResultPoints).toBe(1);
    expect(draw?.awayResultPoints).toBe(1);
  });
});

describe('FlatHtmlFinalMatchAdapter, contro il widget "ULTIMA GIORNATA" reale 2017-18 (Coppa Seconda Fase)', () => {
  it('legge l\'unica partita disponibile come giornata 1', async () => {
    const adapter = new FlatHtmlFinalMatchAdapter('2017-18', 'coppa-seconda-fase');
    const result = await adapter.parse(SECONDA_FASE_FILE);

    expect(result.matchdays).toHaveLength(1);
    expect(result.matchdays[0]?.number).toBe(1);
    expect(result.matchdays[0]?.matches).toHaveLength(1);

    const match = result.matchdays[0]?.matches[0];
    expect(match?.homeTeamName).toBe('Panothinaikos 2014');
    expect(match?.awayTeamName).toBe('Real Cocu 2003 FC');
    expect(match?.homeScore).toBe(75);
    expect(match?.awayScore).toBe(62);
    expect(match?.homeGoals).toBe(2);
    expect(match?.awayGoals).toBe(0);
    expect(match?.homeResultPoints).toBe(3);
    expect(match?.awayResultPoints).toBe(0);
  });
});
