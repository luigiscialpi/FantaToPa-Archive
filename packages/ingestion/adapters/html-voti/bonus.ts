// packages/ingestion/adapters/html-voti/bonus.ts
//
// Fonte: pagina "Voti" di leghe.fantacalcio.it (Formazioni Fantacalcio),
// salvata come HTML statico — un file per giornata di Campionato, con le
// formazioni REALI di tutte le partite di quella giornata (5 per un
// girone da 10 squadre). Diversa da html-legacy/ (mirror Fantagazzetta
// 2018-19): stessa idea di fondo (Handlebars con placeholder {{...}} non
// risolti convivono nel file col DOM reale già renderizzato più sotto), ma
// piattaforma/markup diversi, quindi adapter separato.
//
// Ogni riga giocatore reale ha data-id numerico (il template Handlebars ha
// data-id="{{id}}", mai numerico, quindi la regex sotto lo esclude da sola
// — stesso approccio di html-legacy/roster.ts per un'altra fonte, niente
// parser HTML generico: la struttura è nota, stabile e verificata sui 37
// file reali di una stagione).
//
// Non estraiamo affatto la struttura partita/squadra home-away: un evento
// bonus (es. gol fatto) è un fatto della partita REALE di Serie A, non
// della formazione fantacalcio — se due squadre schierano lo stesso
// giocatore la stessa giornata, condividono lo stesso set di eventi.
// Bastano quindi TUTTE le righe giocatore del file, deduplicate per nome
// (vedi loop sotto), senza legarle a una squadra/match specifico.
import { readFile } from 'node:fs/promises';
import { BonusImportSchema, type BonusImport } from '../../schema/imports.js';
import type { SourceAdapter } from '../types.js';
import { decodeHtmlEntities } from '../html-legacy/decode.js';

// Mappa le etichette italiane della fonte (data-original-title dentro
// <ul class="bonus-list">) sui code di bonus_kinds (migrazione
// 20260731090000) — elenco chiuso, verificato scansionando tutti i 37 file
// di una stagione reale (2025-26, grep su data-original-title su tutti i
// file). Un'etichetta mai vista fa fallire il parse subito col testo esatto
// della fonte, invece di arrivare al loader come code non valido (FK
// violation generica, molto più difficile da diagnosticare).
const LABEL_TO_CODE: Record<string, string> = {
  'Gol segnato (+3)': 'gol_fatto',
  'Gol subito (-1)': 'gol_subito',
  Assist: 'assist',
  'Assist Soft': 'assist_soft',
  'Assist Gold': 'assist_gold',
  'Ammonizione (-0.5)': 'ammonizione',
  'Espulso (-1)': 'espulsione',
  'Autogol (-2)': 'autogol',
  'Rigore segnato (+3)': 'rigore_segnato',
  'Rigore sbagliato (-3)': 'rigore_sbagliato',
  'Rigore parato (+3)': 'rigore_parato',
  'Portiere imbattuto': 'portiere_imbattuto',
  'Player of the match': 'player_of_the_match',
};

// Testo del filtro giornata mostrato come selezionato nella pagina (es.
// `<div class="filter-option-inner-inner">3° giornata</div>`) — più
// robusto del nome file, che nell'orchestrazione capita coincida (001.html
// -> 1° giornata, verificato su tutti i 37 file) ma non è garantito dalla
// fonte stessa.
const ROUND_RE = /filter-option-inner-inner">(\d+)°\s*giornata/;
const PLAYER_ROW_RE = /<tr data-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;
const NAME_RE = /<a href="https:\/\/www\.fantacalcio\.it\/squadre\/giocatore\/[^"]*"[^>]*>([^<]*)<\/a>/;
const BONUS_LIST_RE = /<ul class="bonus-list">([\s\S]*?)<\/ul>/;
const BONUS_ITEM_RE = /data-original-title="([^"]+)"/g;

function extractMatchdayNumber(html: string): number {
  const m = ROUND_RE.exec(html);
  if (!m) throw new Error('Numero giornata non trovato (filtro giornata assente o nessuna opzione selezionata)');
  return Number(m[1]);
}

function bonusCodesFromRow(rowHtml: string, playerName: string): string[] {
  const listMatch = BONUS_LIST_RE.exec(rowHtml);
  if (!listMatch) return [];
  const codes: string[] = [];
  const itemRe = new RegExp(BONUS_ITEM_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(listMatch[1]!))) {
    const label = m[1]!;
    const code = LABEL_TO_CODE[label];
    if (!code) throw new Error(`Tipo di bonus/malus non riconosciuto per "${playerName}": "${label}"`);
    codes.push(code);
  }
  return codes;
}

export class HtmlVotiBonusAdapter implements SourceAdapter<BonusImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<BonusImport> {
    if (typeof input !== 'string') {
      throw new Error('HtmlVotiBonusAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');
    const matchdayNumber = extractMatchdayNumber(html);

    // playerName -> bonusCodes, deduplicando chi è schierato da più squadre
    // la stessa giornata (stesso evento reale, non dati distinti). Le
    // occorrenze ripetute devono avere lo STESSO set di bonus: se divergono
    // è un bug del parser (o un omonimo non distinto), non "l'ultima vince".
    const byPlayer = new Map<string, string[]>();

    const rowRe = new RegExp(PLAYER_ROW_RE.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = rowRe.exec(html))) {
      const rowHtml = match[2]!;
      const nameMatch = NAME_RE.exec(rowHtml);
      if (!nameMatch) {
        throw new Error(`Riga giocatore data-id="${match[1]}" senza link giocatore riconoscibile`);
      }
      const playerName = decodeHtmlEntities(nameMatch[1]!.trim());
      const codes = bonusCodesFromRow(rowHtml, playerName);

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

    if (byPlayer.size === 0) {
      throw new Error('Nessun giocatore reale trovato nel file (struttura pagina inattesa)');
    }

    return BonusImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdayNumber,
      players: [...byPlayer.entries()].map(([playerName, bonusCodes]) => ({ playerName, bonusCodes })),
    });
  }
}
