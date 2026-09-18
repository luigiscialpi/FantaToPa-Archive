// packages/ingestion/adapters/fantacalcio-it/bonus.test.ts
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import { FantacalcioItBonusAdapter } from './bonus.js';

const FIXTURE_FILE = fileURLToPath(new URL('./__fixtures__/2024-25-01.html', import.meta.url));

describe('FantacalcioItBonusAdapter, contro la pagina reale 2024-25 (giornata 1)', () => {
  it('legge il numero di giornata dal filtro selezionato nella pagina', async () => {
    const html = await readFile(FIXTURE_FILE, 'utf-8');
    const adapter = new FantacalcioItBonusAdapter('2024-25', 'campionato');
    const result = await adapter.parse(html);

    expect(result.seasonSlug).toBe('2024-25');
    expect(result.competitionSlug).toBe('campionato');
    expect(result.matchdayNumber).toBe(1);
  });

  it('legge un numero di giocatori coerente con 20 squadre di Serie A', async () => {
    const html = await readFile(FIXTURE_FILE, 'utf-8');
    const adapter = new FantacalcioItBonusAdapter('2024-25', 'campionato');
    const result = await adapter.parse(html);

    // 10 partite, ~16-20 giocatori per squadra (titolari+panchina usata): soglia
    // larga, basta escludere che il parser si sia fermato dopo poche squadre.
    expect(result.players.length).toBeGreaterThan(200);
  });

  it('assegna bonus/malus quantificati (data-value) ai giocatori con eventi', async () => {
    const html = await readFile(FIXTURE_FILE, 'utf-8');
    const adapter = new FantacalcioItBonusAdapter('2024-25', 'campionato');
    const result = await adapter.parse(html);
    const byName = new Map(result.players.map((p) => [p.playerName, p.bonusCodes]));

    // Brescianini: 2 gol segnati + player of the match + sostituito (verificato su pagina reale G1 2024-25)
    expect(byName.get('Brescianini')).toEqual(['gol_fatto', 'gol_fatto', 'player_of_the_match', 'uscito']);
    // Retegui: 1 gol segnato + 1 rigore segnato + sostituito
    expect(byName.get('Retegui')).toEqual(['gol_fatto', 'rigore_segnato', 'uscito']);
    // Skorupski: 1 gol subito + 1 rigore parato (non sostituito)
    expect(byName.get('Skorupski')).toEqual(['gol_subito', 'rigore_parato']);
    // Ruggeri: 1 assist (non sostituito)
    expect(byName.get('Ruggeri')).toEqual(['assist']);
    // Orsolini: 1 rigore segnato + player of the match + sostituito
    expect(byName.get('Orsolini')).toEqual(['rigore_segnato', 'player_of_the_match', 'uscito']);
  });

  it('deriva ammonizione/espulsione dalla classe CSS del voto (non dai span bonus)', async () => {
    const html = await readFile(FIXTURE_FILE, 'utf-8');
    const adapter = new FantacalcioItBonusAdapter('2024-25', 'campionato');
    const result = await adapter.parse(html);
    const byName = new Map(result.players.map((p) => [p.playerName, p.bonusCodes]));

    // De Roon: giallo verificato (classe yellow-card sul pill voto, G1 2024-25)
    expect(byName.get('De Roon')).toEqual(['ammonizione']);
    // Azzi: giallo
    expect(byName.get('Azzi')).toEqual(['ammonizione']);
  });

  it('non assegna bonus ai giocatori senza eventi nella giornata', async () => {
    const html = await readFile(FIXTURE_FILE, 'utf-8');
    const adapter = new FantacalcioItBonusAdapter('2024-25', 'campionato');
    const result = await adapter.parse(html);
    const byName = new Map(result.players.map((p) => [p.playerName, p.bonusCodes]));

    // Musso: portiere senza eventi in G1 (portiere_imbattuto non rilevabile
    // da questa fonte — vedi commento nell'adapter)
    expect(byName.get('Musso')).toEqual([]);
  });

  it('deduplica giocatori presenti in più tabelle squadra della stessa pagina', async () => {
    const html = await readFile(FIXTURE_FILE, 'utf-8');
    const adapter = new FantacalcioItBonusAdapter('2024-25', 'campionato');
    const result = await adapter.parse(html);

    // Ogni nome appare una sola volta nel risultato finale
    const names = result.players.map((p) => p.playerName);
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });
});
