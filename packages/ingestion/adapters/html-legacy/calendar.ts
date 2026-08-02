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

// Stagione 2017-18 (mirror flat, pagine HTML statiche — vedi memoria repo
// legacy-seasons-compat.md): calendario.html del Campionato renderizza tutte
// le 38 giornate come blocchi <table> distinti (uno per giornata, "1ª
// GIORNATA - 1ª Serie A" nell'header), non un unico blob "ci" da decodificare
// come il 2018-19. A differenza del 2018-19, qui non esiste un campo
// "punti_cla_a/b" esplicito nella fonte: solo il "risultato" (i gol già
// calcolati dalla piattaforma con la formula fantacalcio a scaglioni, non i
// fantavoti) — i punti classifica 3/1/0 vanno derivati confrontando i gol,
// stessa convenzione già usata da HtmlLegacyFinalMatchAdapter per la Fase
// Finale 2018-19 (mai osservato un pareggio nei punti diverso da gol pari).
function resultPoints(homeGoals: number, awayGoals: number): { home: number; away: number } {
  if (homeGoals === awayGoals) return { home: 1, away: 1 };
  return homeGoals > awayGoals ? { home: 3, away: 0 } : { home: 0, away: 3 };
}

export class FlatHtmlCalendarAdapter implements SourceAdapter<CalendarImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<CalendarImport> {
    if (typeof input !== 'string') {
      throw new Error('FlatHtmlCalendarAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');

    // Ogni box giornata: <h4>Nª GIORNATA - ...</h4> nell'header della
    // tabella, poi <tbody> con una riga <tr> per partita.
    const matchdayPattern = /<h4>(\d+)ª GIORNATA[^<]*<\/h4><\/th><\/tr><\/thead><tbody>([\s\S]*?)<\/tbody>/g;
    const rowPattern =
      /<tr><td class="match"><span class="ssteam tleft"><a[^>]*>([^<]+)<\/a><\/span> <span class="point">([^<]+)<\/span> - <span class="point">([^<]+)<\/span> <span class="ssteam tright"><a[^>]*>([^<]+)<\/a><\/span><\/td><td class="result">([^<]+)<\/td><\/tr>/g;

    const matchdays: CalendarImport['matchdays'] = [];
    let matchdayMatch: RegExpExecArray | null;
    while ((matchdayMatch = matchdayPattern.exec(html))) {
      const number = Number(matchdayMatch[1]);
      const matches: CalendarImport['matchdays'][number]['matches'] = [];
      let rowMatch: RegExpExecArray | null;
      rowPattern.lastIndex = 0;
      while ((rowMatch = rowPattern.exec(matchdayMatch[2]!))) {
        const [homeGoals, awayGoals] = rowMatch[5]!.split('-').map(Number);
        if (homeGoals === undefined || awayGoals === undefined || Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) {
          throw new Error(`Risultato non parsificabile: "${rowMatch[5]}" (giornata ${number}, ${input})`);
        }
        const points = resultPoints(homeGoals, awayGoals);
        matches.push({
          homeTeamName: rowMatch[1]!.trim(),
          awayTeamName: rowMatch[4]!.trim(),
          homeScore: Number(rowMatch[2]!.replace(',', '.')),
          awayScore: Number(rowMatch[3]!.replace(',', '.')),
          homeGoals,
          awayGoals,
          homeResultPoints: points.home,
          awayResultPoints: points.away,
        });
      }
      if (matches.length > 0) matchdays.push({ number, matches });
    }
    if (matchdays.length === 0) throw new Error(`Nessuna giornata trovata nel calendario ${input}`);

    return CalendarImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdays,
    });
  }
}

// Stessa fonte 2017-18: la Fase Finale (eliminazione diretta, 1 sola
// partita) non ha una pagina calendario.html propria — solo il widget
// "ULTIMA GIORNATA" (tabella id="tbultimo") con l'unico risultato che conta,
// stesso ruolo di HtmlLegacyFinalMatchAdapter per il 2018-19 ma markup
// diverso: qui gli attributi class sono scritti "Class" (C maiuscola, refuso
// del sito originale) e le colonne sono team/point/result invece di
// team-name/team-score/team-fpt — da non confondere con FlatHtmlCalendarAdapter
// (usato per il calendario Campionato multi-giornata, minuscolo "class").
export class FlatHtmlFinalMatchAdapter implements SourceAdapter<CalendarImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<CalendarImport> {
    if (typeof input !== 'string') {
      throw new Error('FlatHtmlFinalMatchAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');

    const widgetMatch = /id="tbultimo"[^>]*>([\s\S]*?)<\/table>/.exec(html);
    if (!widgetMatch) throw new Error(`Widget "ULTIMA GIORNATA" (id="tbultimo") non trovato in ${input}`);

    const rowMatch =
      /<td [Cc]lass="match">[\s\S]*?<a[^>]*>([^<]+)<\/a><\/span> <span [Cc]lass="point">([^<]+)<\/span> - <span [Cc]lass="point">([^<]+)<\/span>[\s\S]*?<a[^>]*>([^<]+)<\/a><\/span><\/td><td [Cc]lass="result">([^<]+)<\/td>/.exec(
        widgetMatch[1]!,
      );
    if (!rowMatch) throw new Error(`Partita non trovata nel widget "ULTIMA GIORNATA" di ${input}`);

    const [homeGoals, awayGoals] = rowMatch[5]!.split('-').map(Number);
    if (homeGoals === undefined || awayGoals === undefined || Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) {
      throw new Error(`Risultato non parsificabile: "${rowMatch[5]}" (${input})`);
    }
    const points = resultPoints(homeGoals, awayGoals);

    return CalendarImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdays: [
        {
          number: 1,
          matches: [
            {
              homeTeamName: rowMatch[1]!.trim(),
              awayTeamName: rowMatch[4]!.trim(),
              homeScore: Number(rowMatch[2]!.replace(',', '.')),
              awayScore: Number(rowMatch[3]!.replace(',', '.')),
              homeGoals,
              awayGoals,
              homeResultPoints: points.home,
              awayResultPoints: points.away,
            },
          ],
        },
      ],
    });
  }
}
