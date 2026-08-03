// packages/ingestion/adapters/html-legacy/roster.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { FlatHtmlRosterAdapter } from './roster.js';

const BOLOGNA_FILE = fileURLToPath(
  new URL('./__fixtures__/2017-18/dettaglio-rosa/bbsatlpr-bologna-ac-17/612107.html', import.meta.url),
);
const UBER_ALLES_FILE = fileURLToPath(
  new URL('./__fixtures__/2017-18/dettaglio-rosa/uber-alles-fussball-club/601779.html', import.meta.url),
);
const BOLOGNA_CREDITS_FILE = fileURLToPath(
  new URL(
    '../../../../docs/Fantacalcio 2017-2018/Campionato/dettaglio-squadra/bbsatlpr-bologna-ac-17/612107.html',
    import.meta.url,
  ),
);

describe('FlatHtmlRosterAdapter, contro le rose reali 2017-18', () => {
  it('legge 25 giocatori per squadra da un singolo file dettaglio-rosa', async () => {
    const adapter = new FlatHtmlRosterAdapter('2017-18');
    const result = await adapter.parse([BOLOGNA_FILE]);

    expect(result.entries).toHaveLength(25);
    const perin = result.entries.find((e) => e.playerName === 'Perin');
    expect(perin?.teamName).toBe('BBSATLPR Bologna AC 17');
    expect(perin?.roles).toEqual(['P']);
    expect(perin?.realTeam).toBe('GENOA');
    expect(perin?.cost).toBe(51);
  });

  it('unisce più file (una squadra per file) in un unico RosterImport', async () => {
    const adapter = new FlatHtmlRosterAdapter('2017-18');
    const result = await adapter.parse([BOLOGNA_FILE, UBER_ALLES_FILE]);

    const teams = new Set(result.entries.map((e) => e.teamName));
    expect(teams).toEqual(new Set(['BBSATLPR Bologna AC 17', 'Uber Alles Fussball Club']));
  });

  it('legge i crediti residui dalla pagina dettaglio-squadra', async () => {
    const adapter = new FlatHtmlRosterAdapter('2017-18', [BOLOGNA_CREDITS_FILE]);
    const result = await adapter.parse([BOLOGNA_FILE]);

    expect(result.teamCredits).toEqual([{ teamName: 'BBSATLPR Bologna AC 17', creditsRemaining: 249 }]);
  });
});
