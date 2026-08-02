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
// preservare la capitalizzazione originale. Nessun dato "crediti residui"
// in questa fonte (a differenza di Rose_x.xlsx): teamCredits resta vuoto,
// gap accettato (RosterImportSchema.teamCredits ha già default []).
const ROLE_LETTER_TO_CODE: Record<string, string> = { P: 'P', D: 'D', C: 'C', A: 'A' };

export class FlatHtmlRosterAdapter implements SourceAdapter<RosterImport> {
  constructor(private readonly seasonSlug: string) {}

  canHandle(input: unknown): boolean {
    return Array.isArray(input) && input.every((p) => typeof p === 'string');
  }

  async parse(input: unknown): Promise<RosterImport> {
    if (!this.canHandle(input)) {
      throw new Error('FlatHtmlRosterAdapter si aspetta string[] (un path per squadra)');
    }
    const filePaths = input as string[];
    const entries: RosterImport['entries'] = [];

    for (const filePath of filePaths) {
      const html = await readFile(filePath, 'utf-8');

      const teamNameMatch = /<span class="titbig2">([^<]+)<\/span>/.exec(html);
      if (!teamNameMatch) throw new Error(`Nome squadra (titbig2) non trovato in ${filePath}`);
      const teamName = decodeHtmlEntities(teamNameMatch[1]!.trim());

      const tableMatch = /<table[^>]*\bid="tbteamdet"[^>]*>([\s\S]*?)<\/table>/.exec(html);
      if (!tableMatch) throw new Error(`Tabella rosa (id="tbteamdet") non trovata in ${filePath}`);

      const rowPattern =
        /<td class="tdrole"><span class="[a-z] role">([A-Z])<\/span><\/td>\s*<td><span class="steam"><a[^>]*>([^<]+)<\/a><\/span><\/td>\s*<td class="pt aleft">([^<]*)<\/td>\s*<td class="pt">(\d+)<\/td>\s*<td class="pt">(\d+)<\/td>/g;
      let rowMatch: RegExpExecArray | null;
      let rowCount = 0;
      while ((rowMatch = rowPattern.exec(tableMatch[1]!))) {
        rowCount++;
        const roleLetter = rowMatch[1]!;
        const role = ROLE_LETTER_TO_CODE[roleLetter];
        if (!role) throw new Error(`Ruolo "${roleLetter}" non riconosciuto (${teamName}, ${filePath})`);
        entries.push({
          teamName,
          playerName: titleCase(decodeHtmlEntities(rowMatch[2]!.trim())),
          roles: [role],
          realTeam: decodeHtmlEntities(rowMatch[3]!.trim()),
          cost: Number(rowMatch[4]),
        });
      }
      if (rowCount === 0) throw new Error(`Nessun giocatore trovato nella rosa di "${teamName}" (${filePath})`);
    }

    return RosterImportSchema.parse({
      seasonSlug: this.seasonSlug,
      entries,
      teamCredits: [],
    });
  }
}
