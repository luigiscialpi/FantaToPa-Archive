// packages/ingestion/adapters/html-legacy/roster.ts
import { readFile } from 'node:fs/promises';
import { RosterImportSchema, type RosterImport } from '../../schema/imports.js';
import type { SourceAdapter } from '../types.js';
import { decodeHtmlEntities, extractTeamBlobs, titleCase } from './decode.js';

// A differenza di standings/calendar, la rosa d'asta richiede DUE fonti:
//   - il blob squadra "lt" (calciatori/costi/crediti, presente su
//     classifica.html/calendario.html/rose.html indifferentemente)
//   - la tabella giocatori di rose*.html (unica fonte per ruolo/nome/squadra
//     reale — "lt" non li contiene). Le pagine rose*.html osservate (rose.html,
//     rose-1..N.html) sono viste duplicate della STESSA tabella completa di
//     250 giocatori: basta leggerne una sola.
export interface HtmlLegacyRosterInput {
  teamBlobFile: string;
  playerTableFile: string;
}

interface PlayerTableRow {
  role: string;
  name: string;
  realTeam: string;
}

// Riga tabella osservata (rose*.html):
//   <tr data-id="2387" ...><td data-key="role">...<span class="role role-p">P</span>...
//   <td data-key="name">...<b class="capitalize">lafont</b>...
//   <td data-key="nation">...</td>
//   <td data-key="team" ...visible-xs>...</td>
//   <td data-key="team" ...hidden-xs><img...><small class="ellipsis">Fiorentina</small></td>
//   <td data-key="price">...</td><td data-key="cost">...</td></tr>
// Il costo asta si legge da "lt.costi" (allineato a "lt.calciatori"), non da
// questa tabella: qui "price"/"cost" sono quotazioni (d'acquisto/attuale),
// non necessariamente il prezzo pagato — vedi memoria repo per la verifica
// incrociata fatta tra i due.
function parsePlayerTable(html: string): Map<number, PlayerTableRow> {
  const rowRe = /<tr data-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;
  const result = new Map<number, PlayerTableRow>();
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(html))) {
    const id = Number(match[1]);
    const rowHtml = match[2]!;
    const roleMatch = /class="role role-([pdca])"/.exec(rowHtml);
    const nameMatch = /<b class="capitalize">([^<]*)<\/b>/.exec(rowHtml);
    const teamMatch = /<small class="ellipsis">([^<]*)<\/small>/.exec(rowHtml);
    if (!roleMatch || !nameMatch || !teamMatch) {
      throw new Error(`Riga giocatore incompleta per data-id="${id}" (role/name/team mancante)`);
    }
    result.set(id, {
      role: roleMatch[1]!.toUpperCase(),
      name: titleCase(decodeHtmlEntities(nameMatch[1]!.trim())),
      realTeam: decodeHtmlEntities(teamMatch[1]!.trim()),
    });
  }
  if (result.size === 0) throw new Error('Nessun giocatore trovato nella tabella rosa');
  return result;
}

export class HtmlLegacyRosterAdapter implements SourceAdapter<RosterImport> {
  constructor(private readonly seasonSlug: string) {}

  canHandle(input: unknown): boolean {
    return (
      typeof input === 'object' &&
      input !== null &&
      typeof (input as { teamBlobFile?: unknown }).teamBlobFile === 'string' &&
      typeof (input as { playerTableFile?: unknown }).playerTableFile === 'string'
    );
  }

  async parse(input: unknown): Promise<RosterImport> {
    if (!this.canHandle(input)) {
      throw new Error('HtmlLegacyRosterAdapter si aspetta { teamBlobFile, playerTableFile }');
    }
    const { teamBlobFile, playerTableFile } = input as HtmlLegacyRosterInput;

    const teamBlobHtml = await readFile(teamBlobFile, 'utf-8');
    const teams = extractTeamBlobs(teamBlobHtml);

    const playerTableHtml = await readFile(playerTableFile, 'utf-8');
    const players = parsePlayerTable(playerTableHtml);

    const entries: RosterImport['entries'] = [];
    const teamCredits: RosterImport['teamCredits'] = [];

    for (const team of teams) {
      const teamName = team.nome.trim();
      teamCredits.push({ teamName, creditsRemaining: team.crediti });

      const ids = team.calciatori.split(';').filter(Boolean).map(Number);
      const costs = team.costi.split(';').filter(Boolean).map(Number);
      if (ids.length !== costs.length) {
        throw new Error(`Squadra "${teamName}": calciatori (${ids.length}) e costi (${costs.length}) disallineati`);
      }

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]!;
        const player = players.get(id);
        if (!player) throw new Error(`Squadra "${teamName}": giocatore id ${id} non trovato nella tabella rosa`);
        entries.push({
          teamName,
          playerName: player.name,
          roles: [player.role],
          realTeam: player.realTeam,
          cost: costs[i]!,
        });
      }
    }

    return RosterImportSchema.parse({
      seasonSlug: this.seasonSlug,
      entries,
      teamCredits,
    });
  }
}

// Stagione 2017-18 (mirror flat — vedi memoria repo
// legacy-seasons-compat.md): niente blob squadra da incrociare con una
// tabella giocatori separata. Ogni squadra ha una pagina dedicata
// (Campionato/dettaglio-rosa/{slug-squadra}/{id}.html) con UNA tabella
// unica id="tbteamdet" che contiene già ruolo/nome/squadra reale/costo
// acquisto/costo attuale per ogni giocatore — costo pagato all'asta è la
// colonna "costo acquisto" (prima delle due), non "costo attuale" (quotazione
// aggiornata nel tempo, valore diverso). Il nome squadra si legge dal
// contenuto (<span class="titbig2">), non dallo slug della cartella, per
// preservare la capitalizzazione originale. Le pagine dettaglio-squadra collegate
// al mirror contengono anche i crediti residui; vengono passate separatamente
// perché dettaglio-rosa non li include.
const ROLE_LETTER_TO_CODE: Record<string, string> = { P: 'P', D: 'D', C: 'C', A: 'A' };
const CREDITS_AVAILABLE_PATTERN =
  /<strong>\s*Crediti disponibili:\s*<\/strong>\s*(?:<span\b[^>]*>)?\s*(-?\d+(?:[.,]\d+)?)\s*(?:<\/span>)?/i;

function cleanText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseCreditsValue(html: string, teamName: string, filePath: string): number | undefined {
  const match = CREDITS_AVAILABLE_PATTERN.exec(html);
  if (!match) return undefined;

  const credits = Number(match[1]!.replace(',', '.'));
  if (!Number.isFinite(credits)) {
    throw new Error(`Crediti disponibili non parsificabili per "${teamName}" in ${filePath}`);
  }
  return credits;
}

function parseDetailTeamCredits(html: string, filePath: string): RosterImport['teamCredits'] {
  const teamNameMatch = /<span\s+class="titbig2">([^<]+)<\/span>/i.exec(html);
  if (!teamNameMatch) return [];

  const teamName = decodeHtmlEntities(teamNameMatch[1]!.trim());
  const credits = parseCreditsValue(html, teamName, filePath);
  if (credits === undefined) return [];
  return [{ teamName, creditsRemaining: credits }];
}

function parseAggregateTeamCredits(html: string, filePath: string): RosterImport['teamCredits'] {
  const headings = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)];
  const credits: RosterImport['teamCredits'] = [];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]!;
    const teamName = cleanText(heading[1]!);
    if (!teamName) continue;

    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? html.length;
    const creditsValue = parseCreditsValue(html.slice(start, end), teamName, filePath);
    if (creditsValue !== undefined) credits.push({ teamName, creditsRemaining: creditsValue });
  }

  if (credits.length === 0) throw new Error(`Nessun credito residuo trovato in ${filePath}`);
  return credits;
}

function parseCreditSource(html: string, filePath: string): RosterImport['teamCredits'] {
  const detailCredits = parseDetailTeamCredits(html, filePath);
  if (detailCredits.length > 0) return detailCredits;
  return parseAggregateTeamCredits(html, filePath);
}

function parseFlatTeamTableRows(tableHtml: string, teamName: string, filePath: string): RosterImport['entries'] {
  const entries: RosterImport['entries'] = [];
  // ponytail: <tr> e <td> possono essere adiacenti (mirror minificato,
  // 2014-15) o separati da whitespace/newline (mirror pretty-printed,
  // 2016-17 dettaglio-rosa) — \s* tollera entrambi i casi, root-cause fix
  // di un regex troppo rigido che faceva risultare "0 giocatori" per il 2016-17.
  const rowPattern =
    /<tr>\s*<td(?: class="tdrole")?><span class="[a-z] role">([A-Z])\s*<\/span><\/td>\s*<td>([\s\S]*?)<\/td>\s*<td class="pt aleft">([^<]*)<\/td>\s*<td class="pt">(\d+)\s*<\/td>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(tableHtml))) {
    const roleLetter = rowMatch[1]!;
    const role = ROLE_LETTER_TO_CODE[roleLetter];
    if (!role) throw new Error(`Ruolo "${roleLetter}" non riconosciuto (${teamName}, ${filePath})`);

    const rawName = rowMatch[2]!
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    entries.push({
      teamName,
      playerName: titleCase(decodeHtmlEntities(rawName)),
      roles: [role],
      realTeam: decodeHtmlEntities(rowMatch[3]!.trim()),
      cost: Number(rowMatch[4]),
    });
  }
  return entries;
}

function parseFlatAggregateRoster(html: string, filePath: string): RosterImport['entries'] {
  const tables = [...html.matchAll(/<table[^>]*\bid="tbteamdet\d+"[^>]*>([\s\S]*?)<\/table>/g)];
  const entries: RosterImport['entries'] = [];

  for (const tableMatch of tables) {
    const tableHtml = tableMatch[1]!;
    const teamNameMatch = /<h3>([^<]+)<\/h3>/.exec(tableHtml);
    if (!teamNameMatch) continue;
    const teamName = decodeHtmlEntities(teamNameMatch[1]!.trim());
    const teamEntries = parseFlatTeamTableRows(tableHtml, teamName, filePath);
    if (teamEntries.length === 0) {
      throw new Error(`Nessun giocatore trovato nella rosa aggregata di "${teamName}" (${filePath})`);
    }
    entries.push(...teamEntries);
  }

  return entries;
}

export class FlatHtmlRosterAdapter implements SourceAdapter<RosterImport> {
  private readonly creditFiles: string[];

  constructor(private readonly seasonSlug: string, creditFiles?: string | string[]) {
    this.creditFiles = creditFiles ? (Array.isArray(creditFiles) ? creditFiles : [creditFiles]) : [];
  }

  canHandle(input: unknown): boolean {
    return Array.isArray(input) && input.every((p) => typeof p === 'string');
  }

  async parse(input: unknown): Promise<RosterImport> {
    if (!this.canHandle(input)) {
      throw new Error('FlatHtmlRosterAdapter si aspetta string[] (un path per squadra)');
    }
    const filePaths = input as string[];
    const entries: RosterImport['entries'] = [];
    const teamCredits = new Map<string, number>();

    for (const filePath of filePaths) {
      const html = await readFile(filePath, 'utf-8');

      const teamNameMatch = /<span class="titbig2">([^<]+)<\/span>/.exec(html);
      const tableMatch = /<table[^>]*\bid="tbteamdet"[^>]*>([\s\S]*?)<\/table>/.exec(html);

      if (teamNameMatch && tableMatch) {
        const teamName = decodeHtmlEntities(teamNameMatch[1]!.trim());
        const teamEntries = parseFlatTeamTableRows(tableMatch[1]!, teamName, filePath);
        if (teamEntries.length === 0) {
          throw new Error(`Nessun giocatore trovato nella rosa di "${teamName}" (${filePath})`);
        }
        entries.push(...teamEntries);
        for (const credit of parseDetailTeamCredits(html, filePath)) {
          teamCredits.set(credit.teamName, credit.creditsRemaining);
        }
        continue;
      }

      const aggregateEntries = parseFlatAggregateRoster(html, filePath);
      if (aggregateEntries.length === 0) {
        throw new Error(
          `Nessuna tabella rosa riconosciuta in ${filePath} (atteso dettaglio squadra "tbteamdet" o aggregato "tbteamdetN")`,
        );
      }
      entries.push(...aggregateEntries);
    }

    for (const creditFile of this.creditFiles) {
      const creditsHtml = await readFile(creditFile, 'utf-8');
      for (const credit of parseCreditSource(creditsHtml, creditFile)) {
        teamCredits.set(credit.teamName, credit.creditsRemaining);
      }
    }

    return RosterImportSchema.parse({
      seasonSlug: this.seasonSlug,
      entries,
      teamCredits: [...teamCredits].map(([teamName, creditsRemaining]) => ({ teamName, creditsRemaining })),
    });
  }
}
