// packages/ingestion/adapters/html-legacy/bonus.ts
//
// Bonus/malus per la stagione 2017-18: stessa fonte già usata da lineup.ts
// (Campionato/formazioni-N.html — la Coppa non ha formazioni in questa
// fonte, quindi nessun bonus derivabile lì, a differenza del 2025-26 dove
// matchday_bonus_sources copre la Coppa). Ogni riga giocatore ha uno span
// `<span class="ico">` con un `<img alt="...">` per ogni evento (un
// giocatore può averne più di uno, anche ripetuti: es. un portiere con 3
// "gol subito" nella stessa partita).
//
// Non usiamo la struttura box-match/home-away: un evento bonus è un fatto
// della partita REALE di Serie A, non della formazione fantacalcio — se
// più squadre fantacalcio schierano lo stesso giocatore la stessa
// giornata, condividono lo stesso set di eventi (stesso principio di
// html-voti/bonus.ts, la fonte equivalente per il 2025-26).
import { readFile } from 'node:fs/promises';
import { BonusImportSchema, type BonusImport } from '../../schema/imports.js';
import type { SourceAdapter } from '../types.js';
import { decodeHtmlEntities, titleCase } from './decode.js';
import { PLAYER_ROW_PATTERN, readMatchdayNumber } from './lineup.js';

// Etichette italiane (attributo alt delle icone, dominio fantagenius.com)
// mappate sui code di bonus_kinds — elenco chiuso, verificato scansionando
// tutti i 38 file formazioni-N.html della stagione (grep su alt="..."). Un
// valore mai visto fa fallire il parse subito col testo esatto della
// fonte, invece di arrivare al loader come code non valido.
const LABEL_TO_CODE: Record<string, string> = {
  'gol fatto': 'gol_fatto',
  'gol subito': 'gol_subito',
  assist: 'assist',
  'assist da fermo': 'assist_fermo',
  ammonizione: 'ammonizione',
  espulsione: 'espulsione',
  autorete: 'autogol',
  'rigore segnato': 'rigore_segnato',
  'rigore sbagliato': 'rigore_sbagliato',
  'rigore parato': 'rigore_parato',
};

const ICO_SPAN_PATTERN = /<span class="ico">([\s\S]*?)<\/span>/;
const ALT_PATTERN = /alt="([^"]*)"/g;

function bonusCodesFromRow(rowHtml: string, playerName: string): string[] {
  const icoMatch = ICO_SPAN_PATTERN.exec(rowHtml);
  if (!icoMatch) return [];
  const codes: string[] = [];
  const altRe = new RegExp(ALT_PATTERN.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = altRe.exec(icoMatch[1]!))) {
    const label = m[1]!;
    const code = LABEL_TO_CODE[label];
    if (!code) throw new Error(`Tipo di bonus/malus non riconosciuto per "${playerName}": "${label}"`);
    codes.push(code);
  }
  return codes;
}

export class FlatHtmlBonusAdapter implements SourceAdapter<BonusImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<BonusImport> {
    if (typeof input !== 'string') {
      throw new Error('FlatHtmlBonusAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');
    const matchdayNumber = readMatchdayNumber(html, input);

    // playerName -> bonusCodes: un giocatore reale schierato da più squadre
    // fantacalcio la stessa giornata compare in più box-match dello stesso
    // file — dedup per nome, verificando che le occorrenze concordino
    // (altrimenti è un bug del parser, non un dato realmente divergente).
    const byPlayer = new Map<string, string[]>();
    const rowRe = new RegExp(PLAYER_ROW_PATTERN.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = rowRe.exec(html))) {
      const playerName = titleCase(decodeHtmlEntities(match[3]!.trim()));
      const codes = bonusCodesFromRow(match[0]!, playerName);

      const existing = byPlayer.get(playerName);
      if (existing) {
        const same = existing.length === codes.length && existing.every((c, i) => c === codes[i]);
        if (!same) {
          throw new Error(
            `Bonus incoerenti per "${playerName}" nella stessa giornata: [${existing.join(', ')}] vs [${codes.join(', ')}]`,
          );
        }
        continue;
      }
      byPlayer.set(playerName, codes);
    }
    if (byPlayer.size === 0) throw new Error(`Nessun giocatore trovato in ${input}`);

    return BonusImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdayNumber,
      players: [...byPlayer.entries()].map(([playerName, bonusCodes]) => ({ playerName, bonusCodes })),
    });
  }
}
