import { type StandingsImport } from '../../../schema/imports.js';
import type { SourceAdapter } from '../../types.js';
import { decodeHtmlEntities } from '../decode.js';
import { Html2013StandingsAdapter } from '../2013-14/standings.js';

function cleanText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeStandings(standings: StandingsImport): StandingsImport {
  return {
    ...standings,
    rows: standings.rows.map((row) => ({ ...row, teamName: cleanText(row.teamName) })),
  };
}

export class Html2011StandingsAdapter implements SourceAdapter<StandingsImport> {
  private readonly delegate: Html2013StandingsAdapter;

  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {
    this.delegate = new Html2013StandingsAdapter(seasonSlug, competitionSlug);
  }

  canHandle(input: unknown): boolean {
    return this.delegate.canHandle(input);
  }

  async parse(input: unknown): Promise<StandingsImport> {
    const standings = await this.delegate.parse(input);
    return normalizeStandings(standings);
  }
}
