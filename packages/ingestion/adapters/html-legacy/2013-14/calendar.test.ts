import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Html2013CalendarAdapter } from './calendar.js';

const CALENDAR_FILE = fileURLToPath(new URL('../__fixtures__/2013-14/calendario-coppa.html', import.meta.url));

describe('Html2013CalendarAdapter, contro il calendario reale 2013-14', () => {
  it('legge le 5 giornate e le 13 partite della Fase finale Coppa Lelle', async () => {
    const adapter = new Html2013CalendarAdapter('2013-14', 'coppa-fase-finale');
    const result = await adapter.parse(CALENDAR_FILE);

    expect(result.matchdays.map((matchday) => matchday.number)).toEqual([1, 2, 3, 4, 5]);
    expect(result.matchdays.map((matchday) => matchday.matches.length)).toEqual([4, 4, 2, 2, 1]);
    expect(result.matchdays.flatMap((matchday) => matchday.matches)).toHaveLength(13);
  });

  it('separa fantavoti, risultato reale e punti classifica', async () => {
    const adapter = new Html2013CalendarAdapter('2013-14', 'coppa-fase-finale');
    const result = await adapter.parse(CALENDAR_FILE);
    const firstMatch = result.matchdays[0]!.matches[0]!;

    expect(firstMatch).toEqual({
      homeTeamName: 'Nemesis 08 F.C',
      awayTeamName: 'Steaua Ste',
      homeScore: 65,
      awayScore: 60,
      homeGoals: 0,
      awayGoals: 0,
      homeResultPoints: 1,
      awayResultPoints: 1,
    });
  });
});