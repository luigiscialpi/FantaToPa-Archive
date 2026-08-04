import { readFile } from 'node:fs/promises';
import { StandingsImportSchema, type StandingsImport } from '../../../schema/imports.js';
import type { SourceAdapter } from '../../types.js';
import { decodeHtmlEntities } from '../decode.js';

function cleanText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseInt10(value: string, label: string, filePath: string): number {
  const parsed = Number(cleanText(value));
  if (!Number.isInteger(parsed)) throw new Error(`${label} non parsificabile in ${filePath}: "${value}"`);
  return parsed;
}

function parseFantapoints(value: string, filePath: string): number {
  const parsed = Number(cleanText(value).replace(',', '.'));
  if (!Number.isFinite(parsed)) throw new Error(`Somma punti non parsificabile in ${filePath}: "${value}"`);
  return parsed;
}

// Tabella "classifica generale" del vecchio Leghe Fantagazzetta (stesso
// markup usato da Html2013CalendarAdapter/Html2013LineupAdapter): righe già
// ordinate per posizione, colonne Pt./G/V/N/P/G+/G-/Somma Pt. — a differenza
// della Coppa Fase Finale 2013-14 (solo G/Pt/Pt.Totali), qui sono tutte
// presenti.
export class Html2013StandingsAdapter implements SourceAdapter<StandingsImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<StandingsImport> {
    if (typeof input !== 'string') {
      throw new Error('Html2013StandingsAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');
    const tableMatch = /<table\b[^>]*id="classifica"[^>]*>([\s\S]*?)<\/table>/i.exec(html);
    if (!tableMatch) throw new Error(`Tabella classifica non trovata in ${input}`);
    const bodyMatch = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(tableMatch[1]!);
    if (!bodyMatch) throw new Error(`Corpo classifica non trovato in ${input}`);

    const rows: StandingsImport['rows'] = [];
    const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    let position = 0;
    while ((rowMatch = rowPattern.exec(bodyMatch[1]!))) {
      const cells = [...rowMatch[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
      if (cells.length !== 10) throw new Error(`Riga classifica con ${cells.length} colonne (attese 10) in ${input}`);

      const teamMatch = /title="Visualizza i dettagli della squadra ([^"]+)"/i.exec(cells[0]![1]!);
      if (!teamMatch) throw new Error(`Nome squadra non trovato in una riga di ${input}`);

      position += 1;
      rows.push({
        teamName: decodeHtmlEntities(teamMatch[1]!.trim()),
        position,
        points: parseInt10(cells[1]![1]!, 'Punti', input),
        played: parseInt10(cells[2]![1]!, 'Giocate', input),
        won: parseInt10(cells[3]![1]!, 'Vinte', input),
        drawn: parseInt10(cells[4]![1]!, 'Pareggiate', input),
        lost: parseInt10(cells[5]![1]!, 'Perse', input),
        goalsFor: parseInt10(cells[6]![1]!, 'Gol fatti', input),
        goalsAgainst: parseInt10(cells[7]![1]!, 'Gol subiti', input),
        totalFantapoints: parseFantapoints(cells[8]![1]!, input),
      });
    }

    if (rows.length === 0) throw new Error(`Nessuna riga classifica trovata in ${input}`);

    return StandingsImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      rows,
    });
  }
}
