import { readFile } from 'node:fs/promises';
import { LineupImportSchema, type LineupImport, type LineupPlayerImport } from '../../../schema/imports.js';
import type { SourceAdapter } from '../../types.js';
import { decodeHtmlEntities, titleCase } from '../decode.js';
import { Html2013LineupAdapter, readMatchdayNumber2013 } from '../2013-14/lineup.js';

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

function normalizeTeamName(value: string): string {
  return cleanText(value);
}

function normalizeLineup(lineup: LineupImport): LineupImport {
  return {
    ...lineup,
    matches: lineup.matches.map((match) => ({
      home: { ...match.home, teamName: normalizeTeamName(match.home.teamName) },
      away: match.away ? { ...match.away, teamName: normalizeTeamName(match.away.teamName) } : undefined,
    })),
  };
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
  return match ? parseFooterNumber(match[1]!, label, 'formazione 2011-12') : undefined;
}

function parseTeamTableAlt(tableHtml: string, filePath: string): LineupImport['matches'][number]['home'] {
  const theadMatch = /<thead\b[^>]*>([\s\S]*?)<\/thead>/i.exec(tableHtml);
  if (!theadMatch) throw new Error(`Header formazione non trovato in ${filePath}`);
  const nameMatch = /<td\b[^>]*colspan="4"[^>]*>([\s\S]*?)<\/td>/i.exec(theadMatch[1]!);
  if (!nameMatch) throw new Error(`Nome squadra non trovato nell'header in ${filePath}`);
  const teamName = decodeHtmlEntities(nameMatch[1]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

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
    if (cells.length < 4) continue;
    const role = cleanText(cells[0]![1]!);
    if (!ROLE_CODES.has(role)) {
      throw new Error(`Ruolo "${role}" non riconosciuto per "${teamName}" (${filePath})`);
    }

    players.push({
      playerName: titleCase(cleanText(cells[1]![1]!)),
      roles: [role],
      voto: parseVoto(cells[3]![1]!),
      fantavoto: null,
      slot,
      countsForTotal: false,
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
    defenseModifier: parseModifier(footer, 'Modificatore Difesa') ?? 0,
    fieldAdvantage: parseModifier(footer, 'Fattore Campo') ?? 0,
    total: parseFooterNumber(totalCell[1]!, 'Totale', filePath),
    players,
    ...parseSubmission(cleanText(footer)),
  };
}

export class Html2011LineupAdapter implements SourceAdapter<LineupImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<LineupImport> {
    if (typeof input !== 'string') {
      throw new Error('Html2011LineupAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');
    const matchdayNumber = readMatchdayNumber2013(html, input);

    if (/class="sqrow2"/i.test(html)) {
      const lineup = await new Html2013LineupAdapter(this.seasonSlug, this.competitionSlug).parse(input);
      return normalizeLineup(lineup);
    }

    const matches: LineupImport['matches'] = [];
    const blockPattern = /<div class="partitablock">([\s\S]*?)(?=<div class="clear">\s*<\/div>)/gi;
    let blockMatch: RegExpExecArray | null;
    const allTables: string[] = [];
    while ((blockMatch = blockPattern.exec(html))) {
      const block = blockMatch[1]!;
      for (const table of block.matchAll(/<table\b[^>]*class="tbasicsmall\s+half"[^>]*>([\s\S]*?)<\/table>/gi)) {
        allTables.push(table[1]!);
      }
    }

    if (allTables.length === 0) throw new Error(`Nessuna tabella formazione trovata in ${input}`);
    if (allTables.length % 2 !== 0) {
      throw new Error(`Numero dispari di tabelle formazione (${allTables.length}) in ${input}`);
    }

    for (let i = 0; i < allTables.length; i += 2) {
      matches.push({
        home: parseTeamTableAlt(allTables[i]!, input),
        away: parseTeamTableAlt(allTables[i + 1]!, input),
      });
    }

    return normalizeLineup(
      LineupImportSchema.parse({
        seasonSlug: this.seasonSlug,
        competitionSlug: this.competitionSlug,
        matchdayNumber,
        matches,
      }),
    );
  }
}
