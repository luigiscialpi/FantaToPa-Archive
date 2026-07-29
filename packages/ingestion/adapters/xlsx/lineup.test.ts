// packages/ingestion/adapters/xlsx/lineup.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { XlsxLineupAdapter } from './lineup.js';

const REAL_FILE = fileURLToPath(
  new URL('./__fixtures__/Formazioni_fantatopa_1_giornata.xlsx', import.meta.url),
);

describe('XlsxLineupAdapter, contro il file reale 2025-26 (giornata 1)', () => {
  it('legge 5 partite con 11 titolari ciascuno', async () => {
    const adapter = new XlsxLineupAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    expect(result.matchdayNumber).toBe(1);
    expect(result.matches).toHaveLength(5);

    for (const match of result.matches) {
      const homeStarters = match.home.players.filter((p) => p.slot === 'titolare');
      const awayStarters = match.away.players.filter((p) => p.slot === 'titolare');
      expect(homeStarters).toHaveLength(11);
      expect(awayStarters).toHaveLength(11);
    }
  });

  it('normalizza i nomi squadra e legge formazione/totale', async () => {
    const adapter = new XlsxLineupAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    const firstMatch = result.matches[0];
    expect(firstMatch?.home.teamName).not.toMatch(/ $/);
    expect(firstMatch?.away.teamName).not.toMatch(/ $/);
    expect(firstMatch?.home.formation).toBeTruthy();
    expect(firstMatch?.away.formation).toBeTruthy();
    expect(firstMatch?.home.total).toBeGreaterThan(0);
    expect(firstMatch?.away.total).toBeGreaterThan(0);
  });

  it('splitta ruoli multipli e converte "-"/"sv" in voto null', async () => {
    const adapter = new XlsxLineupAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    const multiRole = result.matches.flatMap((m) => [...m.home.players, ...m.away.players]).find((p) => p.roles.length > 1);
    expect(multiRole).toBeDefined();

    const nullVoto = result.matches.flatMap((m) => [...m.home.players, ...m.away.players]).find((p) => p.voto === null);
    expect(nullVoto).toBeDefined();
  });

  it('legge modificatore difesa e info di invio ("Inserita via...") per entrambe le squadre', async () => {
    const adapter = new XlsxLineupAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    const firstMatch = result.matches[0];
    expect(firstMatch?.home.defenseModifier).toBe(1);
    expect(firstMatch?.away.defenseModifier).toBe(1);
    expect(firstMatch?.home.submittedVia).toBe('app');
    expect(firstMatch?.home.submittedAt).toBe('2025-08-29T18:06:24');
    expect(firstMatch?.away.submittedVia).toBe('web');
    expect(firstMatch?.away.submittedAt).toBe('2025-08-29T14:10:55');
  });

  it('legge countsForTotal dal colore del fantavoto, non dal solo voto/slot', async () => {
    const adapter = new XlsxLineupAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    const homePlayers = result.matches[0]?.home.players ?? [];

    // Titolare che ha giocato: conta per il totale.
    const meret = homePlayers.find((p) => p.playerName === 'Meret');
    expect(meret?.countsForTotal).toBe(true);

    // Titolare senza voto (non ha giocato): non conta.
    const deWinter = homePlayers.find((p) => p.playerName === 'De Winter');
    expect(deWinter?.voto).toBeNull();
    expect(deWinter?.countsForTotal).toBe(false);

    // Panchinaro con un fantavoto reale (6.5, non "-") ma comunque escluso dal
    // totale: prova che il flag non è deducibile da voto/fantavoto null, va
    // letto dal colore font (caso reale nel file: riga Palestra).
    const palestra = homePlayers.find((p) => p.playerName === 'Palestra');
    expect(palestra?.slot).toBe('panchina');
    expect(palestra?.fantavoto).toBe(6.5);
    expect(palestra?.countsForTotal).toBe(false);

    // Panchinaro che invece sostituisce un titolare e il cui voto conta:
    // stesso slot "panchina" di Palestra, ma countsForTotal true.
    const zappa = homePlayers.find((p) => p.playerName === 'Zappa');
    expect(zappa?.slot).toBe('panchina');
    expect(zappa?.countsForTotal).toBe(true);
  });
});

const NO_DEFENSE_MODIFIER_FILE = fileURLToPath(
  new URL('./__fixtures__/Formazioni_fantatopa_37_giornata.xlsx', import.meta.url),
);

describe('XlsxLineupAdapter, quando una squadra non ha modificatore difesa (giornata 37)', () => {
  it('non legge un totale falso dalla riga "Inserita via" della squadra sfalsata', async () => {
    // Bug reale: quando away non applica un modificatore difesa, il file
    // salta del tutto la sua riga "Modificatore difesa" e le colonne
    // home/away si desincronizzano di una riga per il resto del blocco
    // partita. Il totale away finiva per essere letto dalla riga "Inserita
    // via ... il 22-05-2026 ..." (il parser prendeva "22" come se fosse un
    // punteggio). Il vero totale (61,50) è già disponibile una riga sopra,
    // sulla stessa riga del "Modificatore difesa" di home.
    const adapter = new XlsxLineupAdapter('2025-26', 'campionato');
    const result = await adapter.parse(NO_DEFENSE_MODIFIER_FILE);

    const match = result.matches.find(
      (m) => m.home.teamName.startsWith('PROZALPI') && m.away.teamName.startsWith('CARLOPAROLA'),
    );
    expect(match).toBeDefined();
    expect(match?.away.defenseModifier).toBe(0);
    expect(match?.away.total).toBe(61.5);
    expect(match?.home.total).toBe(65.5);

    // Stesso schema, seconda partita della stessa giornata: prova che non è
    // un caso isolato del primo match, ma un pattern ricorrente nel file.
    const secondMatch = result.matches.find(
      (m) => m.home.teamName.startsWith('UNIONE SPORTIVA NERITINA') && m.away.teamName.startsWith('REAL COCU'),
    );
    expect(secondMatch).toBeDefined();
    expect(secondMatch?.away.defenseModifier).toBe(0);
    expect(secondMatch?.away.total).toBe(66);
  });
});
