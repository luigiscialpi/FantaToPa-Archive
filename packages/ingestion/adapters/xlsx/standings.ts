// packages/ingestion/adapters/xlsx/standings.ts
import * as XLSX from 'xlsx';
import { StandingsImportSchema, type StandingsImport } from '../../schema/imports.js';
import type { SourceAdapter } from '../types.js';

// Layout osservato nei file reali (sezione 2 del piano): titolo, url lega,
// riga vuota, intestazioni, poi i dati — sempre da riga 4 in poi (indice 0).
// Esistono due varianti:
//   - Campionato: Pos, Squadra, ?, G, V, N, P, Gf, Gs, Dr, Pt, Pt. Totali
//   - Coppa:      Pos, Squadra, ?, G, Pt, Pt. Totali
// ponytail: supportiamo solo queste due varianti già osservate; un formato
// futuro diverso richiede un adapter esteso, non euristiche più complesse.
const HEADER_ROW_COUNT = 4;

function isNumberLike(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  return Number.isFinite(Number(v));
}

function parseStandingRow(r: unknown[]): StandingsImport['rows'][number] {
  const fullLayout = isNumberLike(r[11]);
  if (fullLayout) {
    return {
      teamName: String(r[1]).trim(),
      position: Number(r[0]),
      played: Number(r[3]),
      won: Number(r[4]),
      drawn: Number(r[5]),
      lost: Number(r[6]),
      goalsFor: Number(r[7]),
      goalsAgainst: Number(r[8]),
      points: Number(r[10]),
      totalFantapoints: Number(r[11]),
    };
  }
  // Layout ridotto (Coppa): solo G, Pt, Pt. Totali.
  return {
    teamName: String(r[1]).trim(),
    position: Number(r[0]),
    played: Number(r[3]),
    points: Number(r[4]),
    totalFantapoints: Number(r[5]),
  };
}

export class XlsxStandingsAdapter implements SourceAdapter<StandingsImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.xlsx');
  }

  async parse(input: unknown): Promise<StandingsImport> {
    if (typeof input !== 'string') {
      throw new Error('XlsxStandingsAdapter si aspetta un path file (string)');
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

    const rows = raw.slice(HEADER_ROW_COUNT).filter((r) => r[0] !== null && r[0] !== undefined);

    const candidate = {
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      rows: rows.map(parseStandingRow),
    };

    // Fallisce rumorosamente se qualcosa non torna, invece di scrivere dati
    // sporchi (sezione 7 del piano).
    return StandingsImportSchema.parse(candidate);
  }
}
