// packages/ingestion/adapters/xlsx/standings.ts
import * as XLSX from 'xlsx';
import { StandingsImportSchema, type StandingsImport } from '../../schema/imports.js';
import type { SourceAdapter } from '../types.js';

// Layout osservato nei file reali (sezione 2 del piano): titolo, url lega,
// riga vuota, intestazioni, poi i dati — sempre da riga 4 in poi (indice 0).
// ponytail: assume questo layout fisso per tutte le stagioni 2023-24 -> 2025-26,
// non gestisce varianti xlsx non ancora osservate. Se una stagione futura
// cambia formato, questo adapter va esteso o affiancato da uno nuovo — non
// riscritto per "provare a indovinare" layout diversi.
const HEADER_ROW_COUNT = 4;

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
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    const rows = raw.slice(HEADER_ROW_COUNT).filter((r) => r[0] !== null && r[0] !== undefined);

    const candidate = {
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      rows: rows.map((r) => ({
        // .trim(): "Prozalpi S.F. " con spazio finale è un dato reale visto
        // nei file (sezione 2) — normalizzato qui, l'alias vero e proprio lo
        // risolve il loader (sezione 7), qui solo pulizia di base.
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
      })),
    };

    // Fallisce rumorosamente se qualcosa non torna, invece di scrivere dati
    // sporchi (sezione 7 del piano).
    return StandingsImportSchema.parse(candidate);
  }
}
