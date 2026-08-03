import { readFile } from 'node:fs/promises';
import { LineupImportSchema, type LineupImport, type LineupPlayerImport } from '../../../schema/imports.js';
import type { SourceAdapter } from '../../types.js';
import { decodeHtmlEntities, titleCase } from '../decode.js';

const ROLE_CODES = new Set(['P', 'D', 'C', 'A']);

function cleanText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseVoto(value: string): number | null {
  const normalized = cleanText(value).replace(/[()]/g, '').trim();
  if (normalized === '' || normalized === '-') return null;
  const parsed = Number(normalized.replace(',', '.'));
  if (!Number.isFinite(parsed)) throw new Error(`Voto non parsificabile: "${value}"`);
  return parsed;
}

function parseFooterNumber(value: string, label: string, filePath: string): number {
  const parsed = parseVoto(value);
  if (parsed === null) throw new Error(`${label} non parsificabile in ${filePath}`);
  return parsed;
}

function parseSubmission(value: string): { submittedVia?: 'app' | 'web'; submittedAt?: string } {
  const match = /(?:Modificata|Inserita)(?:\s+via\s+(APP|WEB))?\s+il\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})[.:](\d{2})[.:](\d{2})/.exec(
    value,
  );
  if (!match) return {};
  return {
    submittedVia: match[1] ? (match[1].toLowerCase() as 'app' | 'web') : undefined,
    submittedAt: `${match[4]}-${match[3]}-${match[2]}T${match[5]}:${match[6]}:${match[7]}`,
  };
}

function parseModifier(tableHtml: string, label: string): number | undefined {
  const escapedLabel = label.replace(' ', '\\s+');
  const match = new RegExp(
    `<td\\b[^>]*>\\s*${escapedLabel}:\\s*<\\/td>\\s*<td\\b[^>]*>\\s*([^<]+)\\s*<\\/td>`,
    'i',
  ).exec(tableHtml);
  return match ? parseFooterNumber(match[1]!, label, 'formazione 2013-14') : undefined;
}

function parseTeamTable(tableHtml: string, teamName: string, filePath: string): LineupImport['matches'][number]['home'] {
  const formationMatch = /Modulo:\s*(\d+-\d+-\d+)/i.exec(tableHtml);
  const bodyMatch = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(tableHtml);
  if (!bodyMatch) throw new Error(`Corpo formazione non trovato per "${teamName}" (${filePath})`);

  const players: LineupPlayerImport[] = [];
  let slot: LineupPlayerImport['slot'] = 'titolare';
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(bodyMatch[1]!))) {
    const rowHtml = rowMatch[1]!;
    if (/class="div_panchina"/i.test(rowHtml)) {
      slot = 'panchina';
      continue;
    }

    const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 5) continue;
    const role = cleanText(cells[0]![1]!);
    if (!ROLE_CODES.has(role)) {
      throw new Error(`Ruolo "${role}" non riconosciuto per "${teamName}" (${filePath})`);
    }

    players.push({
      playerName: titleCase(cleanText(cells[1]![1]!)),
      roles: [role],
      voto: parseVoto(cells[3]![1]!),
      fantavoto: parseVoto(cells[4]![1]!),
      slot,
      countsForTotal: /<strong\b/i.test(cells[4]![1]!),
    });
  }

  if (players.length === 0) throw new Error(`Nessun giocatore trovato per "${teamName}" (${filePath})`);

  const footerMatch = /<tfoot\b[^>]*>([\s\S]*?)<\/tfoot>/i.exec(tableHtml);
  if (!footerMatch) throw new Error(`Footer formazione non trovato per "${teamName}" (${filePath})`);
  const footer = footerMatch[1]!;
  const totalCells = [...footer.matchAll(/<td\b[^>]*class="aright"[^>]*>([\s\S]*?)<\/td>/gi)];
  const totalCell = totalCells.at(-1);
  if (!totalCell) throw new Error(`Totale formazione non trovato per "${teamName}" (${filePath})`);

  return {
    teamName,
    formation: formationMatch?.[1],
    defenseModifier: parseModifier(footer, 'Modificatore Difesa') ?? 0,
    fieldAdvantage: parseModifier(footer, 'Fattore Campo') ?? 0,
    total: parseFooterNumber(totalCell[1]!, 'Totale', filePath),
    players,
    ...parseSubmission(cleanText(footer)),
  };
}

export function readMatchdayNumber2013(html: string, filePath: string): number {
  const match = /<div\b[^>]*id="lblbox2"[^>]*>[\s\S]*?<h2\b[^>]*>\s*(\d+)\s*(?:&ordf;|ª)\s*GIORNATA\s+COMPETIZIONE/i.exec(html);
  if (!match) throw new Error(`Giornata non trovata nel file formazione 2013-14 ${filePath}`);
  return Number(match[1]);
}

export class Html2013LineupAdapter implements SourceAdapter<LineupImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<LineupImport> {
    if (typeof input !== 'string') {
      throw new Error('Html2013LineupAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');
    const matchdayNumber = readMatchdayNumber2013(html, input);
    const matches: LineupImport['matches'] = [];
    const blockPattern = /<div class="partitablock">([\s\S]*?)(?=<div class="clear">\s*<\/div>)/gi;
    let blockMatch: RegExpExecArray | null;
    while ((blockMatch = blockPattern.exec(html))) {
      const block = blockMatch[1]!;
      if (!block.includes('sqrow2')) continue;
      const headerMatch = /<div class="sqrow2">\s*<h3 class="sq1[^\"]*">([^<]+)<\/h3>\s*<span>[^<]+<\/span>\s*<h3 class="sq2[^\"]*">([^<]+)<\/h3>/i.exec(
        block,
      );
      if (!headerMatch) throw new Error(`Header partita non trovato in ${input}`);
      const tables = [...block.matchAll(/<table\b[^>]*class="tbasicsmall\s+half"[^>]*>([\s\S]*?)<\/table>/gi)];
      if (tables.length !== 2) {
        throw new Error(`Partita "${headerMatch[1]}" vs "${headerMatch[2]}" contiene ${tables.length} tabelle (${input})`);
      }

      const homeName = decodeHtmlEntities(headerMatch[1]!.trim());
      const awayName = decodeHtmlEntities(headerMatch[2]!.trim());
      matches.push({
        home: parseTeamTable(tables[0]![1]!, homeName, input),
        away: parseTeamTable(tables[1]![1]!, awayName, input),
      });
    }

    if (matches.length === 0) throw new Error(`Nessun blocco partita trovato in ${input}`);

    return LineupImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdayNumber,
      matches,
    });
  }
}