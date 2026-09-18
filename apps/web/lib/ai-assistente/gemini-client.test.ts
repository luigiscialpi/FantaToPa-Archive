import { describe, it, expect } from 'vitest';
import { risolviIdentitaUtente, IdentitaUtenteMancanteError } from './gemini-client';

describe('risolviIdentitaUtente', () => {
  it('non tocca una query senza placeholder', () => {
    expect(risolviIdentitaUtente('SELECT 1', null)).toBe('SELECT 1');
  });

  it('sostituisce il placeholder con il team_id reale', () => {
    expect(
      risolviIdentitaUtente(
        'SELECT * FROM matches WHERE home_team_id = CURRENT_TEAM_ID',
        'abc-123'
      )
    ).toBe("SELECT * FROM matches WHERE home_team_id = 'abc-123'");
  });

  it("lancia IdentitaUtenteMancanteError se il placeholder c'è ma teamId è null", () => {
    expect(() => risolviIdentitaUtente('SELECT CURRENT_TEAM_ID', null)).toThrow(
      IdentitaUtenteMancanteError
    );
  });
});

describe('risolviCatenaModelli', () => {
  it('usa i modelli di default quando non ci sono variabili d\'ambiente', async () => {
    const { risolviCatenaModelli, MODELLI_GEMINI_DEFAULT } = await import('./env');
    const catena = risolviCatenaModelli(undefined, undefined);
    expect(catena).toEqual(MODELLI_GEMINI_DEFAULT);
  });

  it('mette il modello configurato singolo in cima alla catena senza duplicati', async () => {
    const { risolviCatenaModelli } = await import('./env');
    const catena = risolviCatenaModelli('gemini-3.5-flash');
    expect(catena[0]).toBe('gemini-3.5-flash');
    // Deve contenere gli altri modelli gratuiti di fallback
    expect(catena).toContain('gemini-3.6-flash');
    expect(catena).toContain('gemini-3.5-flash-lite');
    expect(catena).toContain('gemini-3.1-flash-lite');
    // Nessun duplicato
    expect(new Set(catena).size).toBe(catena.length);
  });

  it('supporta GEMINI_MODELS con lista personalizzata separata da virgole', async () => {
    const { risolviCatenaModelli } = await import('./env');
    const catena = risolviCatenaModelli(undefined, 'custom-model-1, custom-model-2');
    expect(catena[0]).toBe('custom-model-1');
    expect(catena[1]).toBe('custom-model-2');
    expect(catena).toContain('gemini-3.6-flash');
  });
});

describe('assistant_settings', () => {
  it('restituisce i modelli salvati nel database', async () => {
    const { getCatenaModelliAttiva } = await import('./settings');
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { models: ['gemini-custom-1', 'gemini-custom-2'] },
              error: null,
            }),
          }),
        }),
      }),
    };
    const catena = await getCatenaModelliAttiva(
      mockSupabase as unknown as Parameters<typeof getCatenaModelliAttiva>[0]
    );
    expect(catena).toEqual(['gemini-custom-1', 'gemini-custom-2']);
  });

  it('ricade sui default se il record nel db non esiste o da errore', async () => {
    const { getCatenaModelliAttiva } = await import('./settings');
    const { MODELLI_GEMINI_DEFAULT } = await import('./env');
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: new Error('Db error') }),
          }),
        }),
      }),
    };
    const catena = await getCatenaModelliAttiva(
      mockSupabase as unknown as Parameters<typeof getCatenaModelliAttiva>[0]
    );
    expect(catena).toEqual(MODELLI_GEMINI_DEFAULT);
  });
});


