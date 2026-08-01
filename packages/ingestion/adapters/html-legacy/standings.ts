// packages/ingestion/adapters/html-legacy/standings.ts
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { StandingsImportSchema, type StandingsImport } from '../../schema/imports.js';
import type { SourceAdapter } from '../types.js';
import { extractBalancedObject, extractTeamBlobs, teamNameById } from './decode.js';

// La classifica di ogni competizione è un oggetto letterale __.s('ci', {...})
// (non __.dp/__.jp) con sintassi già JSON-valida — vedi decode.ts. "squadre"
// contiene tutte le righe; layout osservato:
//   - Campionato ("full"): g/v/n/pr/gf/gs sono valori reali.
//   - Coppa girone ("reduced"): stessi campi presenti ma sempre a 0 (il
//     girone non ha vittorie/pareggi/sconfitte, solo un punteggio cumulato
//     per giornata) — vanno omessi per rispettare la semantica di
//     StandingsImportSchema (assenti per la Coppa, non "zero").
const HtmlLegacyStandingsRowSchema = z.object({
  id: z.number(),
  pos: z.number().int().positive(),
  g: z.number().int().nonnegative(),
  v: z.number().int().nonnegative(),
  n: z.number().int().nonnegative(),
  pr: z.number().int().nonnegative(),
  gf: z.number().int().nonnegative(),
  gs: z.number().int().nonnegative(),
  p: z.number().int().nonnegative(),
  s_p: z.number(),
});
const HtmlLegacyStandingsBlobSchema = z.object({
  squadre: z.array(HtmlLegacyStandingsRowSchema),
});

export type HtmlLegacyStandingsLayout = 'full' | 'reduced';

export class HtmlLegacyStandingsAdapter implements SourceAdapter<StandingsImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
    private readonly layout: HtmlLegacyStandingsLayout,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<StandingsImport> {
    if (typeof input !== 'string') {
      throw new Error('HtmlLegacyStandingsAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');
    const blob = HtmlLegacyStandingsBlobSchema.parse(JSON.parse(extractBalancedObject(html, 'ci')));
    const teamNames = teamNameById(extractTeamBlobs(html));

    const rows = blob.squadre.map((row) => {
      const teamName = teamNames.get(row.id);
      if (!teamName) throw new Error(`Squadra id ${row.id} non trovata nel blob "lt" di ${input}`);

      const base = {
        teamName,
        position: row.pos,
        points: row.p,
        totalFantapoints: row.s_p,
      };
      if (this.layout === 'reduced') return base;
      return {
        ...base,
        played: row.g,
        won: row.v,
        drawn: row.n,
        lost: row.pr,
        goalsFor: row.gf,
        goalsAgainst: row.gs,
      };
    });

    return StandingsImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      rows,
    });
  }
}

// Le sotto-competizioni "Formula 1" (TIPO COMPETIZIONE: 3, vedi home.html:
// Coppa Girone A/B 2018-19) non incorporano un blob "ci" via __.dp/__.s come
// Campionato: la pagina home.html renderizza la classifica direttamente in
// HTML statico (<tr class="ranking-row" data-id="...">, colonne <td
// data-key="...">). V/N/P/Gf/Gs non esistono per questo formato (girone
// senza incontri 1-a-1, un solo punteggio cumulato per giornata): solo
// index/teamName/rank-pt/rank-fp sono dati reali, stessa semantica
// "reduced" della classifica via blob, sempre e comunque per questo layout
// (non serve un parametro layout: qui non esiste una variante "full").
export class HtmlLegacyGroupTableStandingsAdapter implements SourceAdapter<StandingsImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<StandingsImport> {
    if (typeof input !== 'string') {
      throw new Error('HtmlLegacyGroupTableStandingsAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');

    const rowPattern = /<tr class="ranking-row" data-id="\d+">([\s\S]*?)<\/tr>/g;
    const rows: StandingsImport['rows'] = [];
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowPattern.exec(html))) {
      const rowHtml = rowMatch[1]!;
      const rawCell = (key: string): string => {
        const match = new RegExp(`<td data-key="${key}"[^>]*>([\\s\\S]*?)<\\/td>`).exec(rowHtml);
        if (!match) throw new Error(`Colonna "${key}" non trovata in una riga classifica di ${input}`);
        return match[1]!;
      };
      // Le colonne numeriche possono avere markup interno (icone, span) oltre
      // al testo: sempre ripulite di ogni tag prima di passarle a Number().
      const cell = (key: string): string =>
        rawCell(key)
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      // La cella teamName contiene anche un badge bonus/malus adiacente
      // (<span class="badge...">0</span>): il nome vero è solo il testo
      // dentro <a>, non l'intero contenuto della cella (per questo usa
      // rawCell, non cell, altrimenti il badge finirebbe unito al nome).
      const teamNameMatch = /<a[^>]*>([^<]+)<\/a>/.exec(rawCell('teamName'));
      if (!teamNameMatch) throw new Error(`Nome squadra non trovato in una riga classifica di ${input}`);

      rows.push({
        teamName: teamNameMatch[1]!.trim(),
        position: Number(cell('index')),
        points: Number(cell('rank-pt')),
        totalFantapoints: Number(cell('rank-fp').replace(',', '.')),
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
