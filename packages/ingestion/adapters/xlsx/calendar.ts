// packages/ingestion/adapters/xlsx/calendar.ts
import * as XLSX from 'xlsx';
import { CalendarImportSchema, type CalendarImport } from '../../schema/imports.js';
import type { SourceAdapter } from '../types.js';

// Layout osservato in Calendario_*.xlsx: titolo, url, riga vuota, poi
// intestazioni delle giornate in riga 3. I dati utili sono solo sotto gli
// header "Nª Giornata lega"; le colonne "Nª Giornata serie a" sono vuote
// e vanno ignorate. Ogni giornata occupa un blocco di 5 colonne:
//   col 0: squadra casa
//   col 1: fantavoto casa
//   col 2: fantavoto trasferta
//   col 3: squadra trasferta
//   col 4: risultato (es. "2-2")
function resultPointsFromScore(score: string): { home: number; away: number } {
  const [homeStr, awayStr] = score.split('-');
  const home = Number(homeStr);
  const away = Number(awayStr);
  if (!Number.isFinite(home) || !Number.isFinite(away)) {
    throw new Error(`Risultato non parsificabile: "${score}"`);
  }
  if (home > away) return { home: 3, away: 0 };
  if (home === away) return { home: 1, away: 1 };
  return { home: 0, away: 3 };
}

function parseMatchdayNumber(label: string): number {
  // "1ª Giornata lega" → 1
  const m = label.match(/(\d+)/);
  if (!m) throw new Error(`Numero giornata non trovato in: "${label}"`);
  return Number(m[1]);
}

export class XlsxCalendarAdapter implements SourceAdapter<CalendarImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.xlsx');
  }

  async parse(input: unknown): Promise<CalendarImport> {
    if (typeof input !== 'string') {
      throw new Error('XlsxCalendarAdapter si aspetta un path file (string)');
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

    // ponytail: gli header "Giornata lega" sono distribuiti su più righe,
    // ogni riga-neader contiene due giornate affiancate. Scansioniamo tutto
    // il foglio: ogni cella "Giornata lega" è l'inizio di un blocco di 5
    // colonne con i match della giornata nelle righe successive.
    const matchdays: CalendarImport['matchdays'] = [];

    for (let r = 0; r < raw.length; r++) {
      const row = raw[r];
      if (!Array.isArray(row)) continue;

      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (typeof cell !== 'string' || !cell.includes('Giornata lega')) continue;

        const label = cell.trim();
        const start = c;
        const matches: CalendarImport['matchdays'][number]['matches'] = [];

        for (let dr = 1; dr + r < raw.length; dr++) {
          const dataRow = raw[r + dr];
          if (!Array.isArray(dataRow)) break;

          const homeTeamName = dataRow[start];
          const awayTeamName = dataRow[start + 3];
          const result = dataRow[start + 4];

          // Se incontriamo un altro header, la giornata precedente è finita.
          if (
            typeof homeTeamName === 'string' &&
            homeTeamName.includes('Giornata')
          ) {
            break;
          }

          if (
            homeTeamName === null || homeTeamName === undefined || String(homeTeamName).trim() === '' ||
            awayTeamName === null || awayTeamName === undefined || String(awayTeamName).trim() === '' ||
            result === null || result === undefined || String(result).trim() === ''
          ) {
            continue;
          }

          const homeScore = Number(dataRow[start + 1]);
          const awayScore = Number(dataRow[start + 2]);
          if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
            continue;
          }

          const points = resultPointsFromScore(String(result).trim());
          matches.push({
            homeTeamName: String(homeTeamName).trim(),
            awayTeamName: String(awayTeamName).trim(),
            homeScore,
            awayScore,
            homeResultPoints: points.home,
            awayResultPoints: points.away,
          });
        }

        if (matches.length > 0) {
          matchdays.push({
            number: parseMatchdayNumber(label),
            label: label || undefined,
            matches,
          });
        }
      }
    }

    if (matchdays.length === 0) {
      throw new Error('Nessuna giornata trovata nel calendario');
    }

    return CalendarImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdays,
    });
  }
}
