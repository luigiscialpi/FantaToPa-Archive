import { readFile } from 'node:fs/promises';
import { CalendarImportSchema, type CalendarImport, type LineupImport } from '../../../schema/imports.js';
import type { SourceAdapter } from '../../types.js';
import { decodeHtmlEntities } from '../decode.js';

function cleanText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeTeamName(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\.$/, '').trim();
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

export interface Html2011CalendarInput {
  calendarFile: string;
  /** Formazioni già parsate: usate per arricchire ogni match con i fantapunti
   *  reali (il calendario 2011-12 riporta solo i gol, non i fantapunti). */
  lineups: LineupImport[];
}

type ScoreLookup = Map<string, { home: number; away: number }>;

function buildScoreLookup(lineups: LineupImport[]): Map<number, ScoreLookup> {
  const byMatchday = new Map<number, ScoreLookup>();
  for (const lineup of lineups) {
    const matchdayMap: ScoreLookup = new Map();
    for (const match of lineup.matches) {
      const home = normalizeTeamName(match.home.teamName);
      if (!match.away) continue;
      const away = normalizeTeamName(match.away.teamName);
      const scores = { home: match.home.total, away: match.away.total };
      matchdayMap.set(`${home}|${away}`, scores);
      // Le formazioni possono riportare la stessa coppia in ordine inverso
      // rispetto al calendario: rendiamo il lookup simmetrico.
      matchdayMap.set(`${away}|${home}`, scores);
    }
    byMatchday.set(lineup.matchdayNumber, matchdayMap);
  }
  return byMatchday;
}

export class Html2011CalendarAdapter implements SourceAdapter<CalendarImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return (
      typeof input === 'object' &&
      input !== null &&
      typeof (input as { calendarFile?: unknown }).calendarFile === 'string' &&
      Array.isArray((input as { lineups?: unknown }).lineups)
    );
  }

  async parse(input: unknown): Promise<CalendarImport> {
    if (!this.canHandle(input)) {
      throw new Error('Html2011CalendarAdapter si aspetta { calendarFile: string, lineups: LineupImport[] }');
    }
    const { calendarFile, lineups } = input as Html2011CalendarInput;
    const html = await readFile(calendarFile, 'utf-8');
    const scoreLookup = buildScoreLookup(lineups);

    const matchdayPattern = /<table\b[^>]*class="greyrounded\s+giornate"[^>]*>([\s\S]*?)<\/table>/gi;
    const matchdays: CalendarImport['matchdays'] = [];
    let matchdayMatch: RegExpExecArray | null;

    while ((matchdayMatch = matchdayPattern.exec(html))) {
      const block = matchdayMatch[1]!;
      const headingMatch = /<h2\b[^>]*>\s*(\d+)\s*(?:&ordf;|ª)\s*GIORNATA\b/i.exec(block);
      if (!headingMatch) throw new Error(`Giornata senza numero trovata in ${calendarFile}`);
      const number = Number(headingMatch[1]);
      const bodyMatch = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(block);
      if (!bodyMatch) throw new Error(`Corpo giornata ${number} non trovato in ${calendarFile}`);

      const dayScores = scoreLookup.get(number);
      const matches: CalendarImport['matchdays'][number]['matches'] = [];
      const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowPattern.exec(bodyMatch[1]!))) {
        const cells = [...rowMatch[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
        if (cells.length < 2) {
          throw new Error(`Riga partita incompleta nella giornata ${number} (${calendarFile})`);
        }

        // 2011-12: le squadre sono nella prima cella, il risultato (solo gol)
        // nella seconda. Non ci sono span con i fantapunti come nel 2013-14.
        const teamNames = [...cells[0]![1]!.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((match) =>
          cleanText(match[1]!),
        );
        if (teamNames.length !== 2) {
          throw new Error(`Partita non parsificabile nella giornata ${number} (${calendarFile})`);
        }
        const homeTeamName = teamNames[0]!;
        const awayTeamName = teamNames[1]!;

        const { homeGoals, awayGoals } = parseResult(cells[1]![1]!, `giornata ${number}, ${calendarFile}`);
        const points = resultPoints(homeGoals, awayGoals);

        const scoreKey = `${normalizeTeamName(homeTeamName)}|${normalizeTeamName(awayTeamName)}`;
        const scores = dayScores?.get(scoreKey);
        if (!scores) {
          throw new Error(
            `Fantapunti non trovati per ${homeTeamName} vs ${awayTeamName}, giornata ${number}: ` +
              `assicurarsi che le formazioni siano state parse prima del calendario`,
          );
        }

        matches.push({
          homeTeamName,
          awayTeamName,
          homeScore: scores.home,
          awayScore: scores.away,
          homeGoals,
          awayGoals,
          homeResultPoints: points.home,
          awayResultPoints: points.away,
        });
      }

      if (matches.length === 0) {
        throw new Error(`Nessuna partita trovata nella giornata ${number} (${calendarFile})`);
      }
      matchdays.push({ number, matches });
    }

    if (matchdays.length === 0) throw new Error(`Nessuna giornata trovata nel calendario ${calendarFile}`);

    return CalendarImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdays,
    });
  }
}
