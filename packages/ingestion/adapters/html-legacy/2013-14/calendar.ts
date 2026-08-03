import { readFile } from 'node:fs/promises';
import { CalendarImportSchema, type CalendarImport } from '../../../schema/imports.js';
import type { SourceAdapter } from '../../types.js';
import { decodeHtmlEntities } from '../decode.js';

function cleanText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseNumber(value: string, context: string): number {
  const parsed = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(parsed)) throw new Error(`Numero non parsificabile: "${value}" (${context})`);
  return parsed;
}

function parseResult(value: string, context: string): { homeGoals: number; awayGoals: number } {
  const match = /^(\d+)\s*-\s*(\d+)$/.exec(cleanText(value));
  if (!match) throw new Error(`Risultato non parsificabile: "${value}" (${context})`);
  return { homeGoals: Number(match[1]), awayGoals: Number(match[2]) };
}

function resultPoints(homeGoals: number, awayGoals: number): { home: number; away: number } {
  if (homeGoals === awayGoals) return { home: 1, away: 1 };
  return homeGoals > awayGoals ? { home: 3, away: 0 } : { home: 0, away: 3 };
}

export class Html2013CalendarAdapter implements SourceAdapter<CalendarImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<CalendarImport> {
    if (typeof input !== 'string') {
      throw new Error('Html2013CalendarAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');
    const matchdayPattern = /<table\b[^>]*class="greyrounded\s+giornate"[^>]*>([\s\S]*?)<\/table>/gi;
    const matchdays: CalendarImport['matchdays'] = [];
    let matchdayMatch: RegExpExecArray | null;

    while ((matchdayMatch = matchdayPattern.exec(html))) {
      const block = matchdayMatch[1]!;
      const headingMatch = /<h2\b[^>]*>\s*(\d+)\s*(?:&ordf;|ª)\s*GIORNATA\b/i.exec(block);
      if (!headingMatch) throw new Error(`Giornata senza numero trovata in ${input}`);
      const number = Number(headingMatch[1]);
      const bodyMatch = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(block);
      if (!bodyMatch) throw new Error(`Corpo giornata ${number} non trovato in ${input}`);

      const matches: CalendarImport['matchdays'][number]['matches'] = [];
      const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowPattern.exec(bodyMatch[1]!))) {
        const cells = [...rowMatch[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
        if (cells.length < 2) throw new Error(`Riga partita incompleta nella giornata ${number} (${input})`);

        const firstCell = cells[0]![1]!;
        const teams = [...firstCell.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => cleanText(match[1]!));
        const scores = [...firstCell.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)].map((match) => cleanText(match[1]!));
        if (teams.length !== 2 || scores.length !== 2) {
          throw new Error(`Partita non parsificabile nella giornata ${number} (${input})`);
        }

        const { homeGoals, awayGoals } = parseResult(cells[1]![1]!, `giornata ${number}, ${input}`);
        const points = resultPoints(homeGoals, awayGoals);
        matches.push({
          homeTeamName: teams[0]!,
          awayTeamName: teams[1]!,
          homeScore: parseNumber(scores[0]!, `giornata ${number}, ${input}`),
          awayScore: parseNumber(scores[1]!, `giornata ${number}, ${input}`),
          homeGoals,
          awayGoals,
          homeResultPoints: points.home,
          awayResultPoints: points.away,
        });
      }

      if (matches.length === 0) throw new Error(`Nessuna partita trovata nella giornata ${number} (${input})`);
      matchdays.push({ number, matches });
    }

    if (matchdays.length === 0) throw new Error(`Nessuna giornata trovata nel calendario ${input}`);

    return CalendarImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdays,
    });
  }
}