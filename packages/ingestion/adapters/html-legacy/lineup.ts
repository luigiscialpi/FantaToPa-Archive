// packages/ingestion/adapters/html-legacy/lineup.ts
//
// Condiviso da 2014-15, 2016-17, 2017-18 (mirror flat — vedi memoria repo
// legacy-seasons-compat.md); il 2018-19 non ha formazioni per l'intera
// stagione (fonte diversa, vedi html-legacy/decode.ts). Un file per
// giornata di Campionato (Campionato/formazioni-N.html — la Coppa non ha
// cartella formazioni in questa fonte). Box-match `<div class="row itemBox">` con due tabelle
// affiancate (home poi away), righe `<tr class="playerrow">` (o
// `class="playerrow bnc"`, giocatore "senza voto"/non considerato) separate
// da un `<td class="tdwhite">PANCHINA</td>`, eventuali righe
// "Modificatore difesa"/"Fattore campo" prima del footer con il Totale e la
// riga submission.
//
// TRAPPOLA (verificata leggendo og:url/gselected/LabelGiornata su più file):
// il suffisso numerico del nome file (formazioni-N.html) NON è la giornata
// reale — riflette l'ordine di scaricamento del mirror, non il parametro
// "g=" originale. La giornata va sempre letta da
// <input type="hidden" id="gselected" value="N"> dentro il file stesso, mai
// dedotta dal nome file.
//
// countsForTotal: la cella fantavoto ha classe aggiuntiva "bold" quando il
// giocatore contribuisce al totale squadra — sempre vero per gli 11
// titolari (anche quelli senza voto, classe riga "bnc"), vero per un
// panchinaro SOLO se è subentrato (gli altri panchinari, anche con un voto
// reale preso dalla propria squadra vera, restano esclusi dal totale).
// Verificato su un box-match reale completo (22 giocatori, tutte le
// combinazioni titolare/panchina × giocato/non giocato).
import { readFile } from 'node:fs/promises';
import { LineupImportSchema, type LineupImport, type LineupPlayerImport } from '../../schema/imports.js';
import type { SourceAdapter } from '../types.js';
import { decodeHtmlEntities, titleCase } from './decode.js';

const ROLE_LETTER_TO_CODE: Record<string, string> = { P: 'P', D: 'D', C: 'C', A: 'A' };

export function readMatchdayNumber(html: string, filePath: string): number {
  const match = /id="gselected" value="(\d+)"/.exec(html);
  if (!match) {
    throw new Error(
      `"gselected" non trovato in ${filePath}: impossibile determinare la giornata reale (il suffisso del nome file non è affidabile, vedi commento in testa al modulo)`,
    );
  }
  return Number(match[1]);
}

function readMatchdayLabel(html: string): string | undefined {
  return /id="LabelGiornata">([^<]*)<\/span>/.exec(html)?.[1]?.trim();
}

function parseVotoCell(raw: string): number | null {
  const trimmed = raw.trim();
  return trimmed === '' || trimmed === '-' ? null : Number(trimmed.replace(',', '.'));
}

// "Modificata via APP il 19/05/2018 14:30:50" oppure, osservato altrettanto
// spesso nella stessa fonte, "Modificata il 19/05/2018 10:39:53" (senza
// "via X": il gruppo è opzionale). Convertito in ISO ("yyyy-mm-ddThh:mm:ss",
// stesso formato già prodotto da XlsxLineupAdapter) qui in fase di parsing:
// il formato raw "dd/mm/yyyy" è ambiguo per Postgres (letto come mm/dd,
// fallisce con "date/time field value out of range" su qualunque giorno >
// 12 — bug reale osservato al primo import).
function parseSubmission(text: string): { submittedVia?: 'app' | 'web'; submittedAt?: string } {
  const match = /(?:Modificata|Inserita)(?: via (APP|WEB))? il (\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})/.exec(
    text,
  );
  if (!match) return {};
  const [, via, day, month, year, time] = match;
  return {
    submittedVia: via ? (via.toLowerCase() as 'app' | 'web') : undefined,
    submittedAt: `${year}-${month}-${day}T${time}`,
  };
}

interface ParsedTeamBox {
  formation?: string;
  defenseModifier: number;
  fieldAdvantage: number;
  total: number;
  players: LineupPlayerImport[];
  submittedVia?: 'app' | 'web';
  submittedAt?: string;
}

// Ogni riga giocatore è renderizzata con due celle ruolo duplicate per
// breakpoint responsive (myhidden-xs = vista desktop, myhidden-lg/md/sm =
// vista mobile, valore identico): il pattern cattura entrambe ma il
// chiamante usa solo la prima, non le tratta come due giocatori diversi.
// Esportato per riuso in bonus.ts (stessa fonte, stesso universo di righe
// giocatore reali): quel modulo estrae le icone bonus/malus da match[0]
// (l'intera riga) invece di duplicare questa regex con un gruppo di
// cattura in più per lo span "ico" — evita due regex quasi identiche da
// tenere allineate a mano sulla stessa fonte fragile (vedi memoria repo
// lineup-parsing.md).
export const PLAYER_ROW_PATTERN =
  /<tr class="playerrow( bnc)?"><td class="myhidden-xs"><span class="[a-z] role">([A-Z])\s*<\/span><\/td><td class="myhidden-lg myhidden-md myhidden-sm r"><span class="[a-z] role">[A-Z]\s*<\/span><\/td><td>(?:<span class="sh">)?(?:<a[^>]*>)?([^<]+)(?:<\/a>)?(?:<\/span>)?\s*<span class="ico">[\s\S]*?<\/span><\/td><td class="pt aleft">([^<]*)<\/td><td class="pt">([^<]*)<\/td><td class="pt( bold)?">([^<]*)<\/td><td class="tdrole">[\s\S]*?<\/td><\/tr>/g;

// Formato legacy 2014-15: niente class="playerrow", niente colonne ruolo
// duplicate responsive, nome giocatore direttamente in <td> (spesso con
// icone <img> bonus/malus). Il valore utile è il testo ripulito dai tag.
const LEGACY_PLAYER_ROW_PATTERN =
  /<tr><td><span class="[a-z] role">([A-Z])\s*<\/span><\/td><td>([\s\S]*?)<\/td><td class="pt aleft">([^<]*)<\/td><td class="pt">([^<]*)<\/td><td class="pt([^"]*)">([^<]*)<\/td><td class="tdrole">[\s\S]*?<\/td><\/tr>/g;

function parsePlayers(
  sectionHtml: string,
  slot: 'titolare' | 'panchina',
  teamLabel: string,
  filePath: string,
): LineupPlayerImport[] {
  const players: LineupPlayerImport[] = [];
  PLAYER_ROW_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PLAYER_ROW_PATTERN.exec(sectionHtml))) {
    const roleLetter = match[2]!;
    const role = ROLE_LETTER_TO_CODE[roleLetter];
    if (!role) throw new Error(`Ruolo "${roleLetter}" non riconosciuto (${teamLabel}, ${filePath})`);
    players.push({
      playerName: titleCase(decodeHtmlEntities(match[3]!.trim())),
      roles: [role],
      voto: parseVotoCell(match[5]!),
      fantavoto: parseVotoCell(match[7]!),
      slot,
      countsForTotal: match[6] === ' bold',
    });
  }

  // Fallback per il markup legacy 2014-15.
  if (players.length === 0) {
    LEGACY_PLAYER_ROW_PATTERN.lastIndex = 0;
    while ((match = LEGACY_PLAYER_ROW_PATTERN.exec(sectionHtml))) {
      const roleLetter = match[1]!;
      const role = ROLE_LETTER_TO_CODE[roleLetter];
      if (!role) throw new Error(`Ruolo "${roleLetter}" non riconosciuto (${teamLabel}, ${filePath})`);

      const rawName = match[2]!
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      players.push({
        playerName: titleCase(decodeHtmlEntities(rawName)),
        roles: [role],
        voto: parseVotoCell(match[4]!),
        fantavoto: parseVotoCell(match[6]!),
        slot,
        countsForTotal: match[5]!.includes('bold'),
      });
    }
  }

  return players;
}

function parseTeamBox(tableHtml: string, teamLabel: string, filePath: string): ParsedTeamBox {
  const formationMatch = /<h4>MODULO (\d)(\d)(\d)<\/h4>/.exec(tableHtml);
  const formation = formationMatch ? `${formationMatch[1]}-${formationMatch[2]}-${formationMatch[3]}` : undefined;

  const panchinaIdx = tableHtml.search(/class="tdwhite">PANCHINA/);
  const bodyEndIdx = tableHtml.search(/<\/tbody>/);
  if (bodyEndIdx === -1) throw new Error(`</tbody> non trovato per "${teamLabel}" (${filePath})`);
  const titolariHtml = tableHtml.slice(0, panchinaIdx === -1 ? bodyEndIdx : panchinaIdx);
  const panchinaHtml = panchinaIdx === -1 ? '' : tableHtml.slice(panchinaIdx, bodyEndIdx);

  const players = [
    ...parsePlayers(titolariHtml, 'titolare', teamLabel, filePath),
    ...parsePlayers(panchinaHtml, 'panchina', teamLabel, filePath),
  ];
  if (players.length === 0) throw new Error(`Nessun giocatore trovato per "${teamLabel}" (${filePath})`);

  // Righe opzionali, assenti quando il valore è zero (stessa insidia già
  // nota per Formazioni_*.xlsx — vedi AGENTS.md): non presuppongono nulla
  // sull'altro lato del box-match.
  const defenseModifierMatch = /Modificatore difesa:<\/td><td colspan="\d" class="pt bold">(-?\d+(?:[.,]\d+)?)<\/td>/.exec(
    tableHtml,
  );
  const fieldAdvantageMatch = /Fattore campo:<\/td><td colspan="\d" class="pt bold">(-?\d+(?:[.,]\d+)?)<\/td>/.exec(
    tableHtml,
  );

  const totalMatch = /<span class="numbig4 pull-right">([^<]+)<\/span>/.exec(tableHtml);
  if (!totalMatch) throw new Error(`Totale non trovato per "${teamLabel}" (${filePath})`);

  const tfootMatch = /<tfoot>([\s\S]*)$/.exec(tableHtml);
  const submission = tfootMatch ? parseSubmission(tfootMatch[1]!) : {};

  return {
    formation,
    defenseModifier: defenseModifierMatch ? Number(defenseModifierMatch[1]!.replace(',', '.')) : 0,
    fieldAdvantage: fieldAdvantageMatch ? Number(fieldAdvantageMatch[1]!.replace(',', '.')) : 0,
    total: Number(totalMatch[1]!.replace(',', '.')),
    players,
    ...submission,
  };
}

const HEADER_PATTERN =
  /<h3>([^<]+)<\/h3><\/div><div class="col-lg-2 acenter margin0"><h3 class="numbig3">[^<]*<\/h3><\/div><div class="col-lg-5 aright"><h3>([^<]+)<\/h3>/;
const TABLE_PATTERN = /<table class="table table-striped tbpink">([\s\S]*?)<\/table>/g;
const BOX_PATTERN = /<div class="row itemBox">([\s\S]*?)(?=<div class="row itemBox">|$)/g;

export class FlatHtmlLineupAdapter implements SourceAdapter<LineupImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && /\.html?$/.test(input.toLowerCase());
  }

  async parse(input: unknown): Promise<LineupImport> {
    if (typeof input !== 'string') {
      throw new Error('FlatHtmlLineupAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');
    const matchdayNumber = readMatchdayNumber(html, input);
    const matchdayLabel = readMatchdayLabel(html);

    const matches: LineupImport['matches'] = [];
    BOX_PATTERN.lastIndex = 0;
    let boxMatch: RegExpExecArray | null;
    while ((boxMatch = BOX_PATTERN.exec(html))) {
      const box = boxMatch[1]!;
      const headerMatch = HEADER_PATTERN.exec(box);
      if (!headerMatch) continue; // segmento residuo prima del primo box, non un match reale

      const homeName = decodeHtmlEntities(headerMatch[1]!.trim());
      const awayName = decodeHtmlEntities(headerMatch[2]!.trim());

      const tables = [...box.matchAll(TABLE_PATTERN)];
      if (tables.length === 0) continue;
      if (tables.length > 2) {
        throw new Error(
          `Box-match "${homeName}" vs "${awayName}": ${tables.length} tabelle trovate, attese 1-2 (${input})`,
        );
      }

      const home = { teamName: homeName, ...parseTeamBox(tables[0]![1]!, homeName, input) };
      const away = tables[1] ? { teamName: awayName, ...parseTeamBox(tables[1]![1]!, awayName, input) } : undefined;

      matches.push({ home, away });
    }
    if (matches.length === 0) throw new Error(`Nessun box-match trovato in ${input}`);

    return LineupImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdayNumber,
      matchdayLabel,
      matches,
    });
  }
}
