// packages/ingestion/adapters/xlsx/roster.ts
import * as XLSX from 'xlsx';
import { RosterImportSchema, type RosterImport } from '../../schema/imports.js';
import type { SourceAdapter } from '../types.js';

// Layout osservato in Rose_fantatopa.xlsx: il file è diviso in sezioni
// verticali, ognuna con 2 squadre affiancate. Ogni sezione ha:
//   - riga con i nomi squadra in col 0 e col 5
//   - riga intestazioni "Ruolo","Calciatore","Squadra","Costo"
//   - dati giocatori fino alla riga "Crediti Residui"
const BLOCK_START_COLS = [0, 5];

function parseRoles(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  return String(raw)
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean);
}

function parseCost(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

// Riga di fine sezione, stessa colonna dei ruoli (es. "Crediti Residui: 45").
const CREDITS_REMAINING_PATTERN = /crediti\s*residui\s*:\s*(-?\d+(?:[.,]\d+)?)/i;

export class XlsxRosterAdapter implements SourceAdapter<RosterImport> {
  constructor(private readonly seasonSlug: string) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.xlsx');
  }

  async parse(input: unknown): Promise<RosterImport> {
    if (typeof input !== 'string') {
      throw new Error('XlsxRosterAdapter si aspetta un path file (string)');
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

    const entries: RosterImport['entries'] = [];
    const teamCredits: RosterImport['teamCredits'] = [];

    for (let r = 0; r < raw.length; r++) {
      const row = raw[r];
      if (!Array.isArray(row)) continue;

      for (const start of BLOCK_START_COLS) {
        const teamName = row[start];
        if (teamName === null || teamName === undefined || String(teamName).trim() === '') {
          continue;
        }
        const trimmedTeamName = String(teamName).trim();
        // Salta righe che non sono header di squadra
        const nextRow = raw[r + 1];
        if (!Array.isArray(nextRow) || nextRow[start] !== 'Ruolo') {
          continue;
        }

        // ponytail: il limite di una sezione è la prima riga vuota
        // o la riga "Crediti Residui" — osservato in tutte le sezioni del
        // file 2025-26. Layout diverso = adapter da rivedere, non da
        // rendere "magico".
        for (let dr = 2; dr < raw.length - r; dr++) {
          const dataRow = raw[r + dr];
          if (!Array.isArray(dataRow)) break;
          const playerName = dataRow[start + 1];
          if (playerName === null || playerName === undefined || String(playerName).trim() === '') {
            const creditsValue = CREDITS_REMAINING_PATTERN.exec(String(dataRow[start] ?? ''))?.[1];
            if (creditsValue !== undefined) {
              teamCredits.push({
                teamName: trimmedTeamName,
                creditsRemaining: Number(creditsValue.replace(',', '.')),
              });
            }
            break;
          }
          const roles = parseRoles(dataRow[start]);
          if (roles.length === 0) break; // fine sezione (es. "Crediti Residui")
          entries.push({
            teamName: trimmedTeamName,
            playerName: String(playerName).trim(),
            roles,
            realTeam: dataRow[start + 2] !== null && dataRow[start + 2] !== undefined
              ? String(dataRow[start + 2]).trim()
              : undefined,
            cost: parseCost(dataRow[start + 3]),
          });
        }
      }
    }

    return RosterImportSchema.parse({
      seasonSlug: this.seasonSlug,
      entries,
      teamCredits,
    });
  }
}
