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
