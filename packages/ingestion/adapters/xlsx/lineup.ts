// packages/ingestion/adapters/xlsx/lineup.ts
import * as XLSX from 'xlsx';
import { LineupImportSchema, type LineupImport } from '../../schema/imports.js';
import type { SourceAdapter } from '../types.js';

// Layout osservato in Formazioni_*.xlsx: titolo con "Giornata N" nelle prime
// 2-3 righe, poi blocchi verticali di 1 partita ciascuno.
// Ogni partita:
//   - riga 0: nome home | null... | punteggio | nome away
//   - riga 1: formazione home | null... | formazione away
//   - righe 2-12: 11 titolari (ruolo, nome, null, voto, fantavoto)
//   - riga "Panchina"
//   - righe successive: riserve
//   - riga "Modificatore difesa" con valore in col 4 (home) / col 10 (away)
//   - riga "TOTALE: 74,00" / "TOTALE: 77,50"
//   - riga "Inserita via ..."
//   - riga vuota
const HOME_START = 0;
const AWAY_START = 6;
const SCORE_COL = 5;

function parseNumberOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(',', '.');
  if (s === '' || s === '-' || s.toLowerCase() === 'sv') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseRoles(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  return String(raw)
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean);
}

function looksLikeScore(raw: unknown): boolean {
  return typeof raw === 'string' && /^\d+\s*-\s*\d+$/.test(raw.trim());
}

function looksLikeTeamName(raw: unknown): boolean {
  return typeof raw === 'string' && raw.trim().length > 2 && !raw.includes('Formazioni');
}

function parseTotal(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const s = String(raw).replace(',', '.');
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function extractMatchdayNumber(titleRow: unknown): number {
  if (titleRow === null || titleRow === undefined) {
    throw new Error('Titolo del foglio mancante, non riesco a estrarre il numero giornata');
  }
  const m = String(titleRow).match(/Giornata\s+(\d+)/i);
  if (!m) throw new Error(`Numero giornata non trovato nel titolo: "${titleRow}"`);
  return Number(m[1]);
}

type PartialLineupTeam = {
  teamName: string;
  formation?: string;
  defenseModifier?: number;
  total?: number;
  players: { playerName: string; roles: string[]; voto: number | null; fantavoto: number | null; slot: 'titolare' | 'panchina' }[];
};

export class XlsxLineupAdapter implements SourceAdapter<LineupImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.xlsx');
  }

  async parse(input: unknown): Promise<LineupImport> {
    if (typeof input !== 'string') {
      throw new Error('XlsxLineupAdapter si aspetta un path file (string)');
    }
    const workbook = XLSX.readFile(input);
    const firstSheetName = workbook.SheetNames[0];
    if (firstSheetName === undefined) {
      throw new Error(`Nessun foglio trovato nel file xlsx: ${input}`);
    }
    const sheet = workbook.Sheets[firstSheetName];
    if (sheet === undefined) {
      throw new Error(`Foglio "${firstSheetName}" non trovato nel file xlsx: ${input}`);
    }
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    const matchdayNumber = extractMatchdayNumber(raw[0]?.[0]);

    const matches: LineupImport['matches'] = [];
    let r = 0;

    while (r < raw.length) {
      const row = raw[r];
      if (!Array.isArray(row) || !looksLikeTeamName(row[HOME_START]) || !looksLikeScore(row[SCORE_COL]) || !looksLikeTeamName(row[AWAY_START])) {
        r++;
        continue;
      }

      const homeTeamName = String(row[HOME_START]).trim();
      const awayTeamName = String(row[AWAY_START]).trim();
      const home: PartialLineupTeam = { teamName: homeTeamName, players: [] };
      const away: PartialLineupTeam = { teamName: awayTeamName, players: [] };

      // Formazione
      const formationRow = raw[r + 1];
      if (Array.isArray(formationRow)) {
        if (formationRow[HOME_START]) home.formation = String(formationRow[HOME_START]).trim();
        if (formationRow[AWAY_START]) away.formation = String(formationRow[AWAY_START]).trim();
      }

      let slot: 'titolare' | 'panchina' = 'titolare';

      for (let dr = 2; dr + r < raw.length; dr++) {
        const dataRow = raw[r + dr];
        if (!Array.isArray(dataRow)) break;

        const homeCell0 = dataRow[HOME_START];
        const awayCell0 = dataRow[AWAY_START];

        if (typeof homeCell0 === 'string' && homeCell0.toLowerCase().includes('panchina')) {
          slot = 'panchina';
          continue;
        }

        if (typeof homeCell0 === 'string' && homeCell0.toLowerCase().includes('modificatore')) {
          home.defenseModifier = parseNumberOrNull(dataRow[HOME_START + 4]) ?? undefined;
          away.defenseModifier = parseNumberOrNull(dataRow[AWAY_START + 4]) ?? undefined;
          continue;
        }

        if (typeof homeCell0 === 'string' && homeCell0.toLowerCase().includes('totale')) {
          home.total = parseTotal(homeCell0);
          if (typeof awayCell0 === 'string') away.total = parseTotal(awayCell0);
          break;
        }

        // Se la riga home è un nuovo nome squadra, la partita corrente è finita.
        if (looksLikeTeamName(homeCell0) && looksLikeScore(dataRow[SCORE_COL]) && looksLikeTeamName(awayCell0)) {
          break;
        }

        // Giocatore home
        const homeName = dataRow[HOME_START + 1];
        if (typeof homeName === 'string' && homeName.trim() !== '') {
          const roles = parseRoles(homeCell0);
          if (roles.length > 0) {
            home.players.push({
              playerName: homeName.trim(),
              roles,
              voto: parseNumberOrNull(dataRow[HOME_START + 3]),
              fantavoto: parseNumberOrNull(dataRow[HOME_START + 4]),
              slot,
            });
          }
        }

        // Giocatore away
        const awayName = dataRow[AWAY_START + 1];
        if (typeof awayName === 'string' && awayName.trim() !== '') {
          const roles = parseRoles(awayCell0);
          if (roles.length > 0) {
            away.players.push({
              playerName: awayName.trim(),
              roles,
              voto: parseNumberOrNull(dataRow[AWAY_START + 3]),
              fantavoto: parseNumberOrNull(dataRow[AWAY_START + 4]),
              slot,
            });
          }
        }
      }

      matches.push({
        home: {
          teamName: home.teamName,
          formation: home.formation,
          defenseModifier: home.defenseModifier,
          total: home.total ?? 0,
          players: home.players,
        },
        away: {
          teamName: away.teamName,
          formation: away.formation,
          defenseModifier: away.defenseModifier,
          total: away.total ?? 0,
          players: away.players,
        },
      });

      // Avanza alla fine di questa partita: cerca la riga vuota dopo "Inserita via"
      r++;
      while (r < raw.length) {
        const nextRow = raw[r];
        if (!Array.isArray(nextRow) || nextRow.every((cell) => cell === null || cell === undefined || String(cell).trim() === '')) {
          r++;
          break;
        }
        r++;
      }
    }

    return LineupImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdayNumber,
      matches,
    });
  }
}
