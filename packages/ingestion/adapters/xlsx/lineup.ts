// packages/ingestion/adapters/xlsx/lineup.ts
import { Workbook, ValueType } from 'exceljs';
import type { Worksheet, CellValue } from 'exceljs';
import { LineupImportSchema, type LineupImport, type LineupImportInput } from '../../schema/imports.js';
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
//   - riga "Fattore campo" con valore in col 4/10 — SOLO nei file di Coppa
//     Fase Finale (bonus vantaggio campo dell'eliminazione diretta), assente
//     in Campionato e nei gironi di Coppa.
//   - riga "TOTALE: 74,00" / "TOTALE: 77,50"
//   - riga "Inserita via app|web il DD-MM-YYYY HH:mm:ss"
//   - riga vuota
//
// ATTENZIONE: questo elenco è l'ordine "tipico", non garantito uguale per
// home e away sulla stessa riga. Il file può saltare una riga (es.
// "Modificatore difesa" assente se il modificatore è 0) o averne una in più
// per un solo lato (es. "Fattore campo") indipendentemente per le due
// colonne — le due squadre vanno quindi lette come due stream indipendenti,
// mai assumendo che siano allineate riga per riga. Dettagli e bug reali
// causati da questa assunzione sbagliata nei commenti dentro il loop più
// sotto (branch modificatore/totale/fattore campo).
//
// Usiamo exceljs (non xlsx/SheetJS Community) perché serve leggere il colore
// font delle celle fantavoto: il file marca in verde (font FF008000) i voti
// che concorrono al totale squadra, in grigio gli altri — inclusi i casi di
// un giocatore con un voto reale ma comunque non conteggiato (es. panchinaro
// il cui titolare ha giocato). Verificato che SheetJS Community, anche con
// `cellStyles: true`, non espone affatto il colore font (solo la Pro edition).
const HOME_START = 0;
const AWAY_START = 6;
const GREEN_FONT_ARGB = 'FF008000';
const INSERITA_VIA_RE = /inserita via (app|web) il (\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})/i;

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

function looksLikeTeamName(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const s = raw.trim();
  if (s.length <= 2) return false;
  if (s.includes('Formazioni')) return false;
  // Esclude le formazioni tipo "3-4-3", "4-3-3" o "3412 (343 dopo le sostituzioni)".
  if (/^\d+(?:-\d+)*\s*(?:\(|$)/.test(s)) return false;
  // I ruoli giocatore sono brevi token separati da ; (es. "Ds;Dc", "M;C", "Por").
  if (/^[A-Z][a-z]*(?:;[A-Z][a-z]*)*$/.test(s)) return false;
  return true;
}

function looksLikeMatchStart(row: unknown[]): boolean {
  // Alcuni file (Coppa) non riportano il punteggio tra le due squadre;
  // basta che ci siano due nomi squadra nelle colonne fisse.
  const home = row[HOME_START];
  const away = row[AWAY_START];
  return looksLikeTeamName(home) && looksLikeTeamName(away);
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

function normalizeCellValue(value: CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('result' in value) return value.result ?? null;
    if ('text' in value) return value.text;
    return null;
  }
  return value;
}

// Legge una riga come array 0-indexed di valori grezzi, stesso formato che
// dava `XLSX.utils.sheet_to_json(sheet, { header: 1 })`: riusiamo così la
// logica di parsing esistente basata su offset di colonna fissi.
function rowValues(worksheet: Worksheet, rowIndex0: number, columns = 12): unknown[] {
  const row = worksheet.getRow(rowIndex0 + 1);
  const values: unknown[] = [];
  for (let col0 = 0; col0 < columns; col0++) {
    const cell = row.getCell(col0 + 1);
    // Le celle "seguito" di un merge (es. il banner titolo/legenda unito su
    // tutta la riga) rispecchiano il valore della cella master in exceljs;
    // xlsx/sheet_to_json invece le lasciava vuote. Senza questo controllo la
    // riga di legenda verrebbe letta come un finto nome squadra ripetuto su
    // ogni colonna, generando una partita fantasma.
    values[col0] = cell.type === ValueType.Merge ? null : normalizeCellValue(cell.value);
  }
  return values;
}

function countsForTotalAt(worksheet: Worksheet, rowIndex0: number, col0: number): boolean {
  const cell = worksheet.getRow(rowIndex0 + 1).getCell(col0 + 1);
  if (cell.type === ValueType.Merge) return false;
  return cell.font?.color?.argb === GREEN_FONT_ARGB;
}

function parseSubmission(raw: unknown): { submittedVia: 'app' | 'web'; submittedAt: string } | undefined {
  if (typeof raw !== 'string') return undefined;
  const m = INSERITA_VIA_RE.exec(raw);
  if (!m) return undefined;
  const [via, dd, mm, yyyy, hh, min, ss] = [m[1], m[2], m[3], m[4], m[5], m[6], m[7]];
  // Gruppi tutti obbligatori nel pattern (nessun `?`): se `m` non è null sono
  // garantiti presenti, ma noUncheckedIndexedAccess non lo sa — verifica
  // esplicita invece di asserzioni non-null.
  if (!via || !dd || !mm || !yyyy || !hh || !min || !ss) return undefined;
  return {
    submittedVia: via.toLowerCase() as 'app' | 'web',
    // ponytail: stringa "naive" DD-MM-YYYY HH:mm:ss del file riportata come
    // ISO senza fuso orario (colonna Postgres `timestamp`, non `timestamptz`)
    // — è un dato di sola visualizzazione, non va confrontato con altri
    // istanti cross-timezone. Upgrade path se mai servisse: conversione a
    // UTC assumendo Europe/Rome con calcolo esplicito dell'offset DST.
    submittedAt: `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`,
  };
}

type PartialLineupPlayer = {
  playerName: string;
  roles: string[];
  voto: number | null;
  fantavoto: number | null;
  slot: 'titolare' | 'panchina';
  countsForTotal: boolean;
};

type PartialLineupTeam = {
  teamName: string;
  formation?: string;
  defenseModifier?: number;
  fieldAdvantage?: number;
  total?: number;
  submittedVia?: 'app' | 'web';
  submittedAt?: string;
  players: PartialLineupPlayer[];
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
    const workbook = new Workbook();
    await workbook.xlsx.readFile(input);
    const worksheet = workbook.worksheets[0];
    if (worksheet === undefined) {
      throw new Error(`Nessun foglio trovato nel file xlsx: ${input}`);
    }
    const rowCount = worksheet.rowCount;
    const raw = (rowIndex0: number) => rowValues(worksheet, rowIndex0);

    const matchdayNumber = extractMatchdayNumber(raw(0)[0]);

    // Pre-parse: defenseModifier ancora opzionale qui (il default 0 lo
    // applica LineupImportSchema.parse più sotto).
    const matches: LineupImportInput['matches'] = [];
    let r = 0;

    while (r < rowCount) {
      const row = raw(r);
      if (!looksLikeMatchStart(row)) {
        r++;
        continue;
      }

      const homeTeamName = String(row[HOME_START]).trim();
      const awayTeamName = String(row[AWAY_START]).trim();
      const home: PartialLineupTeam = { teamName: homeTeamName, players: [] };
      const away: PartialLineupTeam = { teamName: awayTeamName, players: [] };

      // Formazione
      const formationRow = raw(r + 1);
      if (formationRow[HOME_START]) home.formation = String(formationRow[HOME_START]).trim();
      if (formationRow[AWAY_START]) away.formation = String(formationRow[AWAY_START]).trim();

      let slot: 'titolare' | 'panchina' = 'titolare';

      for (let dr = 2; dr + r < rowCount; dr++) {
        const dataRowIndex0 = r + dr;
        const dataRow = raw(dataRowIndex0);

        const homeCell0 = dataRow[HOME_START];
        const awayCell0 = dataRow[AWAY_START];

        // Panchina può apparire solo nella colonna away in alcuni file Coppa.
        if (typeof awayCell0 === 'string' && awayCell0.toLowerCase().includes('panchina')) {
          slot = 'panchina';
          continue;
        }

        // Modificatore difesa e TOTALE possono cadere su righe diverse per
        // home e away: quando una squadra non applica il modificatore, il
        // file salta del tutto la sua riga "Modificatore difesa" e la sua
        // colonna guadagna un anticipo di una riga sull'altra per il resto
        // del blocco partita. Il desync è stato osservato in ENTRAMBE le
        // direzioni: away in anticipo su home (giornata 37 2025-26,
        // Carloparola Fc: away.total letto per errore dalla riga "Inserita
        // via..." di away, che non è una riga di totale) e home in anticipo
        // su away (giornata 23 2025-26, Los Cientoquattros Hertha Rallo: la
        // riga "TOTALE" di away non veniva mai raggiunta perché il branch si
        // basava solo su homeCell0, e away.total restava undefined -> 0 di
        // default). Per questo le due fasi vanno rilevate e lette in modo
        // indipendente per ciascuna colonna, non assumendo che siano sempre
        // allineate sulla stessa riga o che sia sempre home a "guidare".
        //
        // Nei file di Coppa Fase Finale esiste anche una riga "Fattore
        // campo" (bonus per chi ha il vantaggio campo in quel turno di
        // eliminazione diretta), presente solo per una colonna. Il suo
        // valore è già incluso nel TOTALE della riga successiva, ma va
        // ANCHE salvato a parte (come defenseModifier) per poterlo mostrare
        // in UI. La riga va comunque riconosciuta ed esclusa dal check
        // "Inserita via..." sotto — altrimenti, quando questa riga coincide
        // con la vera sottomissione dell'altra squadra (già arrivata prima
        // perché non ha "Fattore campo"), il loop si interrompe subito e il
        // totale della squadra ancora in corso (che deve leggere ancora
        // "Fattore campo" + TOTALE + la propria sottomissione) resta
        // undefined -> 0 di default (bug reale: Prozalpi S.F. 0 punti in
        // Coppa Fase Finale giornata 1).
        const homeIsModificatore = typeof homeCell0 === 'string' && homeCell0.toLowerCase().includes('modificatore');
        const awayIsModificatore = typeof awayCell0 === 'string' && awayCell0.toLowerCase().includes('modificatore');
        const homeIsTotale = typeof homeCell0 === 'string' && homeCell0.toLowerCase().includes('totale');
        const awayIsTotale = typeof awayCell0 === 'string' && awayCell0.toLowerCase().includes('totale');
        const homeIsFattoreCampo = typeof homeCell0 === 'string' && homeCell0.toLowerCase().includes('fattore campo');
        const awayIsFattoreCampo = typeof awayCell0 === 'string' && awayCell0.toLowerCase().includes('fattore campo');

        if (
          homeIsModificatore ||
          awayIsModificatore ||
          homeIsTotale ||
          awayIsTotale ||
          homeIsFattoreCampo ||
          awayIsFattoreCampo
        ) {
          if (homeIsModificatore) home.defenseModifier = parseNumberOrNull(dataRow[HOME_START + 4]) ?? undefined;
          if (awayIsModificatore) away.defenseModifier = parseNumberOrNull(dataRow[AWAY_START + 4]) ?? undefined;
          if (homeIsFattoreCampo) home.fieldAdvantage = parseNumberOrNull(dataRow[HOME_START + 4]) ?? undefined;
          if (awayIsFattoreCampo) away.fieldAdvantage = parseNumberOrNull(dataRow[AWAY_START + 4]) ?? undefined;
          if (homeIsTotale) home.total = parseTotal(homeCell0);
          if (awayIsTotale) away.total = parseTotal(awayCell0);
          continue;
        }

        // Riga "Inserita via app|web il ...": ultima riga utile della partita.
        const homeSubmission = parseSubmission(homeCell0);
        const awaySubmission = parseSubmission(awayCell0);
        if (homeSubmission || awaySubmission) {
          if (homeSubmission) {
            home.submittedVia = homeSubmission.submittedVia;
            home.submittedAt = homeSubmission.submittedAt;
          }
          if (awaySubmission) {
            away.submittedVia = awaySubmission.submittedVia;
            away.submittedAt = awaySubmission.submittedAt;
          }
          break;
        }

        // Se la riga home è un nuovo nome squadra, la partita corrente è finita.
        if (looksLikeMatchStart(dataRow)) {
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
              countsForTotal: countsForTotalAt(worksheet, dataRowIndex0, HOME_START + 4),
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
              countsForTotal: countsForTotalAt(worksheet, dataRowIndex0, AWAY_START + 4),
            });
          }
        }
      }

      matches.push({
        home: {
          teamName: home.teamName,
          formation: home.formation,
          defenseModifier: home.defenseModifier,
          fieldAdvantage: home.fieldAdvantage,
          total: home.total ?? 0,
          submittedVia: home.submittedVia,
          submittedAt: home.submittedAt,
          players: home.players,
        },
        away: {
          teamName: away.teamName,
          formation: away.formation,
          defenseModifier: away.defenseModifier,
          fieldAdvantage: away.fieldAdvantage,
          total: away.total ?? 0,
          submittedVia: away.submittedVia,
          submittedAt: away.submittedAt,
          players: away.players,
        },
      });

      // Avanza alla fine di questa partita: cerca la prima riga vuota.
      r++;
      while (r < rowCount) {
        const nextRow = raw(r);
        if (nextRow.every((cell) => cell === null || cell === undefined || String(cell).trim() === '')) {
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
