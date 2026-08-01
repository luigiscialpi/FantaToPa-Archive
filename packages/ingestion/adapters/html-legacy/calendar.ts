// packages/ingestion/adapters/html-legacy/calendar.ts
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { CalendarImportSchema, type CalendarImport } from '../../schema/imports.js';
import type { SourceAdapter } from '../types.js';
import { extractDpBlob, extractTeamBlobs, teamNameById } from './decode.js';

// calendario.html incorpora la chiave "ci" via __.dp(base64) (diverso
// dall'oggetto letterale di classifica.html, vedi decode.ts) con shape
// data.calendario.calendario_incontri: un array di giornate, ognuna con
// "incontri" (le partite). punti_cla_a/b sono i punti classifica (3/1/0)
// già calcolati dalla piattaforma sorgente: li usiamo as-is invece di
// riderivarli dai gol, coerente con "standings non si ricalcola mai" di
// AGENTS.md — qui è un altro campo, ma stesso principio: fidarsi dello
// snapshot fornito dalla fonte, non ricalcolare con una formula nostra.
const HtmlLegacyMatchSchema = z.object({
  id_squadra_a: z.number(),
  id_squadra_b: z.number(),
  riposo_a: z.boolean(),
  riposo_b: z.boolean(),
  risultato: z.string(),
  punti_a: z.number(),
  punti_b: z.number(),
  punti_cla_a: z.number().int().min(0).max(3),
  punti_cla_b: z.number().int().min(0).max(3),
});
const HtmlLegacyGiornataSchema = z.object({
  giornata_lega: z.number().int().positive(),
  incontri: z.array(HtmlLegacyMatchSchema),
});
const HtmlLegacyCalendarBlobSchema = z.object({
  data: z.object({
    calendario: z.object({
      calendario_incontri: z.array(HtmlLegacyGiornataSchema),
    }),
  }),
});

function goalsFromResult(risultato: string): { homeGoals: number; awayGoals: number } {
  const [homeStr, awayStr] = risultato.split('-');
  const homeGoals = Number(homeStr);
  const awayGoals = Number(awayStr);
  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) {
    throw new Error(`Risultato non parsificabile: "${risultato}"`);
  }
  return { homeGoals, awayGoals };
}

export class HtmlLegacyCalendarAdapter implements SourceAdapter<CalendarImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<CalendarImport> {
    if (typeof input !== 'string') {
      throw new Error('HtmlLegacyCalendarAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');
    const blob = HtmlLegacyCalendarBlobSchema.parse(JSON.parse(extractDpBlob(html, 'ci')));
    const teamNames = teamNameById(extractTeamBlobs(html));

    const matchdays: CalendarImport['matchdays'] = [];
    for (const giornata of blob.data.calendario.calendario_incontri) {
      const matches: CalendarImport['matchdays'][number]['matches'] = [];
      for (const incontro of giornata.incontri) {
        // Mai osservato nel 2018-19 (girone unico, nessun riposo), ma il
        // campo esiste nel formato sorgente: una giornata con riposo non è
        // una partita rappresentabile (manca un avversario reale), va
        // saltata invece di far fallire l'intero import.
        if (incontro.riposo_a || incontro.riposo_b) continue;

        const homeTeamName = teamNames.get(incontro.id_squadra_a);
        const awayTeamName = teamNames.get(incontro.id_squadra_b);
        if (!homeTeamName || !awayTeamName) {
          throw new Error(`Squadra non trovata nel blob "lt" per l'incontro ${JSON.stringify(incontro)}`);
        }
        const { homeGoals, awayGoals } = goalsFromResult(incontro.risultato);
        matches.push({
          homeTeamName,
          awayTeamName,
          homeScore: incontro.punti_a,
          awayScore: incontro.punti_b,
          homeGoals,
          awayGoals,
          homeResultPoints: incontro.punti_cla_a,
          awayResultPoints: incontro.punti_cla_b,
        });
      }
      if (matches.length > 0) {
        matchdays.push({ number: giornata.giornata_lega, matches });
      }
    }

    if (matchdays.length === 0) {
      throw new Error('Nessuna giornata trovata nel calendario');
    }

    return CalendarImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdays,
    });
  }
}

// La Fase Finale (eliminazione diretta, TIPO COMPETIZIONE: 9 in home.html)
// non ha un blob calendario "ci" via __.dp come Campionato/Coppa gironi:
// l'unica partita che conta (la finale) è renderizzata come HTML statico
// nel widget "Ultima Giornata" di home.html
// (<li class="list-group-item match match-result...">, due div
// team-home/team-away con team-name/team-score/team-fpt). getCupFinalWinners
// (apps/web/lib/queries/home.ts) determina il vincitore Coppa guardando la
// giornata con il numero più alto della competizione: bastano 1 giornata + 1
// partita, non serve l'intero tabellone (semifinali/quarti restano fuori,
// coerente con "nessun dato recuperabile" già verificato per quelle fasi).
export class HtmlLegacyFinalMatchAdapter implements SourceAdapter<CalendarImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<CalendarImport> {
    if (typeof input !== 'string') {
      throw new Error('HtmlLegacyFinalMatchAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');
    const widgetMatch = /<li class="list-group-item match match-result[^"]*"[^>]*>([\s\S]*?)<\/li>/.exec(html);
    if (!widgetMatch) throw new Error(`Widget "Ultima Giornata" non trovato in ${input}`);

    const sidePattern =
      /data-id="\d+">[\s\S]*?<h5 class="team-name">([^<]+)<\/h5><div class="team-score">([\s\S]*?)<\/div><div class="team-fpt">([^<]+)<\/div>/g;
    const sides: { teamName: string; goals: number; fantapoints: number }[] = [];
    let sideMatch: RegExpExecArray | null;
    while ((sideMatch = sidePattern.exec(widgetMatch[1]!))) {
      sides.push({
        teamName: sideMatch[1]!.trim(),
        goals: Number(sideMatch[2]!.trim()),
        fantapoints: Number(sideMatch[3]!.trim().replace(',', '.')),
      });
    }
    if (sides.length !== 2) {
      throw new Error(`Attese 2 squadre nel widget partita finale, trovate ${sides.length} in ${input}`);
    }
    const home = sides[0]!;
    const away = sides[1]!;

    // Niente punti_cla_a/b nella fonte per questo formato (a differenza del
    // calendario Campionato, che li riusa as-is da "ci"): derivati qui dal
    // risultato con la convenzione standard 3/1/0 — mai osservato un
    // pareggio in una finale a eliminazione diretta nei dati reali.
    const homeResultPoints = home.goals === away.goals ? 1 : home.goals > away.goals ? 3 : 0;
    const awayResultPoints = home.goals === away.goals ? 1 : away.goals > home.goals ? 3 : 0;

    return CalendarImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdays: [
        {
          number: 1,
          matches: [
            {
              homeTeamName: home.teamName,
              awayTeamName: away.teamName,
              homeScore: home.fantapoints,
              awayScore: away.fantapoints,
              homeGoals: home.goals,
              awayGoals: away.goals,
              homeResultPoints,
              awayResultPoints,
            },
          ],
        },
      ],
    });
  }
}
