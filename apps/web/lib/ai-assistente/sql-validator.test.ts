import { describe, it, expect } from 'vitest';
import { validaEWrappa, QueryNonValidaError } from './sql-validator';

describe('sql-validator — casi da rifiutare', () => {
  const casi: Array<[string, string]> = [
    ["INSERT INTO seasons (slug) VALUES ('x')", 'INSERT'],
    ['SELECT * FROM seasons; DROP TABLE seasons;', 'statement multipli'],
    ["SELECT * FROM seasons WHERE id='1'; SELECT * FROM teams", 'due SELECT concatenate'],
    ['SELECT * FROM profiles', 'tabella fuori whitelist'],
    ['SELECT * FROM seasons JOIN profiles ON true', 'tabella fuori whitelist in JOIN'],
    ['SELECT * FROM (SELECT id FROM registration_requests) x', 'tabella fuori whitelist in subquery'],
    ['SELECT pg_sleep(30) FROM seasons', 'funzione pericolosa nella SELECT list'],
    ['SELECT * FROM team_managers()', 'funzione al posto di una tabella'],
    ['SELECT * FROM seasons, team_managers()', 'funzione mescolata a una tabella reale'],
    ['SELECT * FROM seasons s JOIN team_managers() tm ON true', 'funzione via JOIN'],
    ["SELECT dblink('a','b') FROM seasons", 'dblink'],
    ['SELECT pg_sleep(1)', 'nessuna tabella referenziata'],
    ['DELETE FROM seasons', 'DELETE'],
    ["UPDATE seasons SET slug='x'", 'UPDATE'],
  ];

  it.each(casi)('rifiuta: %s (%s)', (sql) => {
    expect(() => validaEWrappa(sql)).toThrow(QueryNonValidaError);
  });
});

describe('sql-validator — casi da accettare', () => {
  const casi = [
    "SELECT count(*) FROM matches WHERE home_team_id = 'x'",
    "SELECT count(*) FROM matches WHERE home_team_id = 'x';",
    "SELECT t.canonical_name, sum(m.home_score) FROM matches m JOIN teams t ON t.id = m.home_team_id GROUP BY t.canonical_name",
    "SELECT * FROM (SELECT id, home_score FROM matches WHERE home_score IS NOT NULL) AS sub",
    "WITH team_sub AS (SELECT id FROM teams) SELECT * FROM team_sub",
  ];

  it.each(casi)('accetta: %s', (sql) => {
    expect(() => validaEWrappa(sql)).not.toThrow();
    expect(validaEWrappa(sql)).toContain('LIMIT 200');
  });
});

describe('sql-validator — CTE con tabella vietata', () => {
  it('rifiuta una CTE che interroga tabelle fuori whitelist', () => {
    expect(() =>
      validaEWrappa('WITH bad AS (SELECT id FROM profiles) SELECT * FROM bad')
    ).toThrow(QueryNonValidaError);
  });
});
