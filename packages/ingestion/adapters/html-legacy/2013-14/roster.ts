import { readFile } from 'node:fs/promises';
import { RosterImportSchema, type RosterImport } from '../../../schema/imports.js';
import type { SourceAdapter } from '../../types.js';
import { decodeHtmlEntities, titleCase } from '../decode.js';

function cleanText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseCost(value: string, teamName: string, filePath: string): number {
  const parsed = Number(cleanText(value).replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Costo non parsificabile per "${teamName}" in ${filePath}: "${value}"`);
  }
  return parsed;
}

function parseTeamCredits(html: string, filePath: string): RosterImport['teamCredits'] {
  const credits: RosterImport['teamCredits'] = [];
  const teamPattern =
    /<div\b[^>]*class="[^"]*\btxtsq\b[^"]*"[^>]*>\s*<h3\b[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p\b[^>]*class="[^"]*\bsqdesc\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
  let teamMatch: RegExpExecArray | null;
  while ((teamMatch = teamPattern.exec(html))) {
    const teamName = cleanText(teamMatch[1]!);
    if (!teamName) throw new Error(`Nome squadra vuoto nei crediti di ${filePath}`);
    credits.push({ teamName, creditsRemaining: parseCost(teamMatch[2]!, teamName, filePath) });
  }

  if (credits.length === 0) throw new Error(`Nessun credito residuo trovato in ${filePath}`);
  return credits;
}

function parseTeamEntries(tableHtml: string, teamName: string, filePath: string): RosterImport['entries'] {
  const bodyMatch = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(tableHtml);
  if (!bodyMatch) throw new Error(`Corpo rosa non trovato per "${teamName}" (${filePath})`);

  const entries: RosterImport['entries'] = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(bodyMatch[1]!))) {
    const cells = [...rowMatch[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length !== 4) {
      throw new Error(`Riga rosa incompleta per "${teamName}" in ${filePath}`);
    }

    const roleMatch = /<span\b[^>]*class="[^\"]*\b(?:ybkg|gbkg|bbkg|rbkg)\b[^\"]*"[^>]*>\s*([PDCA])\s*<\/span>/i.exec(
      cells[0]![1]!,
    );
    if (!roleMatch) throw new Error(`Ruolo non riconosciuto per "${teamName}" in ${filePath}`);

    const playerName = titleCase(cleanText(cells[1]![1]!));
    const realTeam = cleanText(cells[2]![1]!);
    if (!playerName || !realTeam) {
      throw new Error(`Giocatore incompleto per "${teamName}" in ${filePath}`);
    }

    entries.push({
      teamName,
      playerName,
      roles: [roleMatch[1]!.toUpperCase()],
      realTeam,
      cost: parseCost(cells[3]![1]!, teamName, filePath),
    });
  }

  if (entries.length === 0) throw new Error(`Nessun giocatore trovato per "${teamName}" (${filePath})`);
  return entries;
}

export class Html2013RosterAdapter implements SourceAdapter<RosterImport> {
  constructor(private readonly seasonSlug: string, private readonly creditsFile?: string) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<RosterImport> {
    if (typeof input !== 'string') {
      throw new Error('Html2013RosterAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');
    const entries: RosterImport['entries'] = [];
    const teamPattern =
      /<div\b[^>]*class="[^\"]*\bteamleft\b[^\"]*"[^>]*>[\s\S]*?<h3\b[^>]*>\s*<span\b[^>]*id="lblHeaderDisplay"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<table\b[^>]*class="[^\"]*\btbasicsmall\s+half\b[^\"]*"[^>]*>([\s\S]*?)<\/table>/gi;
    let teamMatch: RegExpExecArray | null;
    while ((teamMatch = teamPattern.exec(html))) {
      const teamName = cleanText(teamMatch[1]!);
      if (!teamName) throw new Error(`Nome squadra vuoto in ${input}`);
      entries.push(...parseTeamEntries(teamMatch[2]!, teamName, input));
    }

    if (entries.length === 0) throw new Error(`Nessuna rosa trovata in ${input}`);

    const teamCredits = this.creditsFile
      ? parseTeamCredits(await readFile(this.creditsFile, 'utf-8'), this.creditsFile)
      : [];

    return RosterImportSchema.parse({
      seasonSlug: this.seasonSlug,
      entries,
      teamCredits,
    });
  }
}