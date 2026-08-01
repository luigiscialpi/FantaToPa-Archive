// packages/ingestion/adapters/html-voti/bonus.test.ts
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { HtmlVotiBonusAdapter } from './bonus.js';

const REAL_FILE = fileURLToPath(new URL('./__fixtures__/001.html', import.meta.url));

describe('HtmlVotiBonusAdapter, contro il file reale 2025-26 (giornata 1)', () => {
  it('legge il numero di giornata dal filtro selezionato nella pagina', async () => {
    const adapter = new HtmlVotiBonusAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    expect(result.seasonSlug).toBe('2025-26');
    expect(result.competitionSlug).toBe('campionato');
    expect(result.matchdayNumber).toBe(1);
  });

  it('legge un numero di giocatori coerente con 10 squadre (titolari+panchina)', async () => {
    const adapter = new HtmlVotiBonusAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);

    // 5 partite reali, ~16-18 giocatori per squadra (titolari+panchina):
    // soglia larga, non un conteggio esatto (irrilevante ai fini del test,
    // basta escludere che il parser abbia letto solo il template o si sia
    // fermato a metà file).
    expect(result.players.length).toBeGreaterThan(100);
  });

  it('assegna i bonus/malus corretti ai giocatori con eventi reali', async () => {
    const adapter = new HtmlVotiBonusAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);
    const byName = new Map(result.players.map((p) => [p.playerName, p.bonusCodes]));

    expect(byName.get('Meret')).toEqual(['portiere_imbattuto']);
    expect(byName.get('Pulisic')).toEqual(['gol_fatto']);
    expect(byName.get('Pinamonti')).toEqual(['gol_fatto']);
    expect(byName.get('Zappa')).toEqual(['ammonizione']);
  });

  it('non assegna bonus a chi non ne ha ricevuti, incluso chi non ha giocato', async () => {
    const adapter = new HtmlVotiBonusAdapter('2025-26', 'campionato');
    const result = await adapter.parse(REAL_FILE);
    const byName = new Map(result.players.map((p) => [p.playerName, p.bonusCodes]));

    expect(byName.get('Scalvini')).toEqual([]);
    // "De Winter" non ha giocato quella giornata (voto "-" nel file): niente
    // bonus, ma resta un giocatore valido nel risultato (non va escluso).
    expect(byName.get('De Winter')).toEqual([]);
  });
});
