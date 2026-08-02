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
  // ponytail: i nomi squadra in questo formato file sono sempre TUTTO
  // MAIUSCOLO (convenzione osservata su ogni squadra di ogni fixture nota,
  // impostata a monte dall'app di origine). Qualunque lettera minuscola
  // esclude testo libero come la legenda fissa in cima al file ("In verde i
  // fantavoti che portano punteggio alla squadra", riga 2 di ogni file), che
  // altrimenti supererebbe tutti i controlli precedenti e verrebbe scambiata
  // per un blocco partita "solo" (un solo lato popolato, come un girone
  // dispari con squadra senza avversario) — bug reale osservato: la legenda
  // diventava una 6ª partita fantasma in un file Campionato che non ne ha
  // mai una. Se una stagione futura avesse nomi squadra non interamente
  // maiuscoli, va rivisto qui, non aggirato a valle.
  if (s !== s.toUpperCase()) return false;
  return true;
}

function looksLikeMatchStart(row: unknown[]): boolean {
  // Alcuni file (Coppa) non riportano il punteggio tra le due squadre;
  // basta che ci siano due nomi squadra nelle colonne fisse.
  const home = row[HOME_START];
  const away = row[AWAY_START];
  return looksLikeTeamName(home) && looksLikeTeamName(away);
}

function isBlankCell(raw: unknown): boolean {
  return raw === null || raw === undefined || String(raw).trim() === '';
}

// Gironi di Coppa (5 squadre, numero dispari): ogni giornata una squadra
// resta senza avversario e il file la stampa in un blocco con un solo lato
// popolato (nome squadra pieno, formazione, titolari...) e l'altro lato
// vuoto per l'intero blocco. Ritorna quale lato è popolato, o null se la
// riga non è l'inizio né di un blocco "solo" né di un blocco normale.
function looksLikeSoloMatchStart(row: unknown[]): 'home' | 'away' | null {
  const home = row[HOME_START];
  const away = row[AWAY_START];
  if (looksLikeTeamName(home) && isBlankCell(away)) return 'home';
  if (looksLikeTeamName(away) && isBlankCell(home)) return 'away';
  return null;
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

// Una cella "Modificatore difesa"/"Fattore campo"/"TOTALE: N"/"Inserita
// via..." somiglia spesso a un nome squadra per looksLikeTeamName (stringa
// lunga, non un token ruolo, non un pattern modulo) — va esclusa esplicitamente
// dal check di inizio-nuova-partita, altrimenti due di queste righe allineate
// sulla stessa riga (o anche una sola, con l'altra colonna già a null perché
// il suo lato ha finito prima) verrebbero scambiate per l'header della
// partita successiva.
function isTerminalMarkerCell(cell0: unknown): boolean {
  if (typeof cell0 !== 'string') return false;
  const lower = cell0.toLowerCase();
  return (
    lower.includes('modificatore') ||
    lower.includes('fattore campo') ||
    lower.includes('totale') ||
    parseSubmission(cell0) !== undefined
  );
}

// Applica il contenuto della cella di UNA colonna (home o away) alla
// squadra corrispondente. Le due colonne vanno avanzate in modo
// indipendente perché possono avere panchine di lunghezza molto diversa —
// osservato concretamente nei file classico 2020-2021/2021-2022/2022-2023
// (fino a 10 vs 13 giocatori in panchina nello stesso match): il lato con la
// panchina più corta raggiunge Modificatore/Fattore campo/Totale/Inserita
// via con molte righe di anticipo sull'altro, non solo una. Ritorna true
// quando la riga "Inserita via..." di QUESTA squadra è stata letta (fine
// blocco per questo lato).
function applyTeamCell(
  team: PartialLineupTeam,
  cell0: unknown,
  dataRow: unknown[],
  columnStart: number,
  worksheet: Worksheet,
  dataRowIndex0: number,
  slot: 'titolare' | 'panchina',
): boolean {
  if (typeof cell0 === 'string') {
    const lower = cell0.toLowerCase();
    if (lower.includes('modificatore')) {
      team.defenseModifier = parseNumberOrNull(dataRow[columnStart + 4]) ?? undefined;
      return false;
    }
    if (lower.includes('fattore campo')) {
      team.fieldAdvantage = parseNumberOrNull(dataRow[columnStart + 4]) ?? undefined;
      return false;
    }
    if (lower.includes('totale')) {
      team.total = parseTotal(cell0);
      return false;
    }
    const submission = parseSubmission(cell0);
    if (submission) {
      team.submittedVia = submission.submittedVia;
      team.submittedAt = submission.submittedAt;
      return true;
    }
  }

  const name = dataRow[columnStart + 1];
  if (typeof name === 'string' && name.trim() !== '') {
    const roles = parseRoles(cell0);
    if (roles.length > 0) {
      team.players.push({
        playerName: name.trim(),
        roles,
        voto: parseNumberOrNull(dataRow[columnStart + 3]),
        fantavoto: parseNumberOrNull(dataRow[columnStart + 4]),
        slot,
        countsForTotal: countsForTotalAt(worksheet, dataRowIndex0, columnStart + 4),
      });
    }
  }
  return false;
}

// Normalizza una squadra parsata nella forma attesa da LineupMatchImportSchema.
// Usata sia per un lato di un blocco normale, sia per l'unica squadra di un
// blocco "solo" (girone dispari) — in quel caso finisce sempre in `home`
// dell'output, indipendentemente dalla colonna sorgente (home o away): non
// è mai un vantaggio/svantaggio campo reale, solo un dettaglio di
// impaginazione del file, quindi non va portato a valle.
function toTeamImport(team: PartialLineupTeam) {
  return {
    teamName: team.teamName,
    formation: team.formation,
    defenseModifier: team.defenseModifier,
    fieldAdvantage: team.fieldAdvantage,
    total: team.total ?? 0,
    submittedVia: team.submittedVia,
    submittedAt: team.submittedAt,
    players: team.players,
  };
}

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
      const soloSide = looksLikeSoloMatchStart(row);
      if (!looksLikeMatchStart(row) && !soloSide) {
        r++;
        continue;
      }

      const hasHome = soloSide !== 'away';
      const hasAway = soloSide !== 'home';
      const homeTeamName = hasHome ? String(row[HOME_START]).trim() : '';
      const awayTeamName = hasAway ? String(row[AWAY_START]).trim() : '';
      const home: PartialLineupTeam = { teamName: homeTeamName, players: [] };
      const away: PartialLineupTeam = { teamName: awayTeamName, players: [] };

      // Formazione
      const formationRow = raw(r + 1);
      if (hasHome && formationRow[HOME_START]) home.formation = String(formationRow[HOME_START]).trim();
      if (hasAway && formationRow[AWAY_START]) away.formation = String(formationRow[AWAY_START]).trim();

      let slot: 'titolare' | 'panchina' = 'titolare';
      // Ognuna diventa true quando la riga "Inserita via..." di QUEL lato è
      // stata letta — vedi applyTeamCell per il perché vanno tracciate in
      // modo indipendente invece che con un singolo continue/break condiviso.
      // Il lato assente in un blocco "solo" parte già a true: non c'è niente
      // da leggere per quel lato.
      let homeDone = !hasHome;
      let awayDone = !hasAway;

      for (let dr = 2; dr + r < rowCount; dr++) {
        const dataRowIndex0 = r + dr;
        const dataRow = raw(dataRowIndex0);

        const homeCell0 = dataRow[HOME_START];
        const awayCell0 = dataRow[AWAY_START];

        // Panchina può apparire solo su un lato (alcuni file Coppa la
        // omettono sull'altro; in un blocco "solo" l'altro lato è sempre
        // vuoto) — i titolari sono sempre esattamente 11 per entrambe le
        // squadre, quindi questa riga cade sempre allineata: basta trovarla
        // su uno qualunque dei due lati.
        if (
          (typeof homeCell0 === 'string' && homeCell0.toLowerCase().includes('panchina')) ||
          (typeof awayCell0 === 'string' && awayCell0.toLowerCase().includes('panchina'))
        ) {
          slot = 'panchina';
          continue;
        }

        // Un nuovo blocco partita inizia solo se nessuna delle due colonne è
        // un marcatore di fine blocco su questa riga (vedi isTerminalMarkerCell)
        // — altrimenti una riga come "TOTALE: N" (che looksLikeTeamName
        // considera un possibile nome squadra) verrebbe scambiata per l'inizio
        // di una nuova partita prima ancora di leggerne il valore.
        if (
          !isTerminalMarkerCell(homeCell0) &&
          !isTerminalMarkerCell(awayCell0) &&
          (looksLikeMatchStart(dataRow) || looksLikeSoloMatchStart(dataRow) !== null)
        ) {
          break;
        }

        // Le due colonne vanno lette come stream indipendenti: quando una
        // squadra ha una panchina più corta dell'altra, la sua colonna
        // raggiunge Modificatore/Fattore campo/Totale/Inserita via con
        // diverse righe di anticipo (non solo una — osservato fino a 3 righe
        // nei file classico 2020-2021/2021-2022/2022-23, dove le panchine
        // arrivano ad avere 10 vs 13 giocatori nello stesso match). Un
        // singolo continue/break condiviso su "una delle due colonne ha
        // trovato il marcatore" perdeva sia i giocatori panchina ancora da
        // leggere sul lato più lungo, sia il suo totale (mai raggiunto prima
        // del break) — bug reale, non solo teorico: verificato riga per riga
        // su Formazioni_fantatopa_38_giornata.xlsx (2020-2021).
        if (!homeDone) {
          homeDone = applyTeamCell(home, homeCell0, dataRow, HOME_START, worksheet, dataRowIndex0, slot);
        }
        if (!awayDone) {
          awayDone = applyTeamCell(away, awayCell0, dataRow, AWAY_START, worksheet, dataRowIndex0, slot);
        }

        if (homeDone && awayDone) {
          break;
        }
      }

      if (hasHome && hasAway) {
        matches.push({ home: toTeamImport(home), away: toTeamImport(away) });
      } else {
        // Blocco "solo": l'unica squadra presente finisce sempre in `home`
        // nell'output, qualunque sia la colonna sorgente — vedi toTeamImport.
        matches.push({ home: toTeamImport(hasHome ? home : away) });
      }

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
