// packages/ingestion/adapters/fantacalcio-it/bonus.ts
//
// Fonte: pagina pubblica "Voti Fantacalcio Serie A" di fantacalcio.it
// (https://www.fantacalcio.it/voti-fantacalcio-serie-a/{stagione}/{giornata}),
// non login-gated (verificato per 2025-26 e 2020-21 — vedi
// docs/bonus-storici-fantacalcio-it.md sezione 6). Markup diverso da
// html-voti/bonus.ts (leghe.fantacalcio.it, bonus-list con
// data-original-title): qui ogni giocatore ha una riga <tr> con un blocco
// `<div class="group">` di <span class="player-bonus" data-value="N"
// title="Label">` per ciascun tipo di bonus/malus, N = conteggio eventi
// (non punti) — verificato scaricando la pagina reale 2024-25 giornata 1.
//
// Questa fonte elenca TUTTI i giocatori di Serie A schierati dai voti
// ufficiali, non solo quelli presenti nelle rose della lega: un nome può
// non esistere nel nostro DB per la stagione (mai preso all'asta). Per
// questo l'adapter si limita a produrre i dati grezzi — il filtro sui
// giocatori noti alla lega spetta allo script di orchestrazione (vedi
// import-bonus-fantacalcio-it.ts), non a questo parser, che non deve fare
// I/O verso Supabase.
//
// Ammonizione/espulsione non sono colonne esplicite di questa fonte (niente
// `<span class="player-bonus">` dedicato), ma il voto della colonna
// "Redazione Fantacalcio" porta la classe CSS `yellow-card`/`red-card`
// quando il giocatore è stato ammonito/espulso (verificato su HTML reale
// 2024-25 giornata 1: 39 gialli, 1 rosso). Niente derivazione aritmetica dal
// delta voto/fantavoto: un tentativo iniziale in tal senso falliva sempre
// (residuo 0 anche per giocatori ammoniti), perché qui il voto stesso è già
// abbassato dal cartellino — fantavoto lo riflette una volta sola, non due.
// portiere_imbattuto invece NON è rilevabile da questa fonte: verificato che
// i portieri con zero gol subiti hanno sempre voto === fantavoto (nessun
// residuo), quindi quel bonus non viene importato per queste stagioni.
import { BonusImportSchema, type BonusImport } from '../../schema/imports.js';
import type { SourceAdapter } from '../types.js';
import { decodeHtmlEntities } from '../html-legacy/decode.js';

// Etichette osservate scansionando il markup reale (attributo `title` dentro
// `<span class="player-bonus ...">`) — elenco chiuso, un'etichetta mai vista
// fa fallire il parse subito col testo esatto della fonte.
const LABEL_TO_CODE: Record<string, string> = {
  'Gol segnati': 'gol_fatto',
  'Gol subiti': 'gol_subito',
  Autoreti: 'autogol',
  'Rigori segnati': 'rigore_segnato',
  'Rigori sbagliati': 'rigore_sbagliato',
  'Rigori parati': 'rigore_parato',
  Assist: 'assist',
  'Player of the match': 'player_of_the_match',
};

// Icona subentrato/sostituito accanto al nome (title="Subentrato"/
// "Sostituito") — stesso concetto dei bonus_kinds 'subentrato'/'uscito'
// aggiunti per il recupero 2011-14 (migrazione 20260804160000).
const SUB_LABEL_TO_CODE: Record<string, string> = {
  Subentrato: 'subentrato',
  Sostituito: 'uscito',
};

// Il filtro giornata mostrato come selezionato (`<option value="N"
// selected>Giornata N</option>`) — più robusto del numero nell'URL/nome
// file, stesso principio del ROUND_RE di html-voti/bonus.ts.
const ROUND_RE = /<option value="\d+" selected>Giornata (\d+)<\/option>/;
const ROW_RE = /<tr>([\s\S]*?)<\/tr>/g;
const ROLE_RE = /<span class="role" data-value="([a-z]+)">/;
const NAME_RE = /<a class="player-name player-link"[^>]*>\s*<span>([^<]*)<\/span>/;
const SUB_ICON_RE = /alt="Icona (Subentrato|Sostituito|subentrato|sostituito)"/;
const BONUS_SPAN_RE = /<span class="player-bonus[^"]*"\s+data-value="(-?\d+)"\s+title="([^"]+)">/g;
// Cattura la classe del primo pill ("Redazione Fantacalcio"): vuota, o
// `yellow-card`/`red-card` quando il giocatore è stato ammonito/espulso —
// confermato su HTML reale 2024-25 giornata 1 (es. De Roon: voto 6,5 con
// classe `yellow-card`, fantavoto 6, coerente col -0.5 di ammonizione).
const FIRST_PILL_RE =
  /<span class="player-grade\s*(yellow-card|red-card)?" data-value="[^"]+"><\/span>/;

const CARD_CLASS_TO_CODE: Record<string, string> = {
  'yellow-card': 'ammonizione',
  'red-card': 'espulsione',
};

// Deriva ammonizione/espulsione dalla classe CSS del primo pill (colonna
// "Redazione Fantacalcio"). Non richiede la lettura di voto/fantavoto: la
// classe è già un'indicazione esplicita della fonte, non un'inferenza.
function deriveCardCodes(rowHtml: string): string[] {
  const pillMatch = FIRST_PILL_RE.exec(rowHtml);
  const cardClass = pillMatch?.[1];
  if (!cardClass) return [];
  const code = CARD_CLASS_TO_CODE[cardClass];
  return code ? [code] : [];
}

function extractMatchdayNumber(html: string): number {
  const m = ROUND_RE.exec(html);
  if (!m) throw new Error('Numero giornata non trovato (opzione "selected" del filtro giornata assente)');
  return Number(m[1]);
}

function bonusCodesFromRow(rowHtml: string, playerName: string): string[] {
  const codes: string[] = [];
  const spanRe = new RegExp(BONUS_SPAN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = spanRe.exec(rowHtml))) {
    const value = Number(m[1]);
    const label = m[2]!;
    const code = LABEL_TO_CODE[label];
    if (!code) throw new Error(`Tipo di bonus/malus non riconosciuto per "${playerName}": "${label}"`);
    for (let i = 0; i < value; i++) codes.push(code);
  }
  const subMatch = SUB_ICON_RE.exec(rowHtml);
  if (subMatch) {
    const label = subMatch[1]![0]!.toUpperCase() + subMatch[1]!.slice(1).toLowerCase();
    const code = SUB_LABEL_TO_CODE[label];
    if (code) codes.push(code);
  }
  return codes;
}

export class FantacalcioItBonusAdapter implements SourceAdapter<BonusImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<BonusImport> {
    if (typeof input !== 'string') {
      throw new Error('FantacalcioItBonusAdapter si aspetta un contenuto HTML (string)');
    }
    const html = input;
    const matchdayNumber = extractMatchdayNumber(html);

    // playerName -> bonusCodes, deduplicando i giocatori che compaiono più
    // volte nella pagina (una tabella per squadra, 20 tabelle a giornata):
    // stesso evento reale, mai duplicato. Le righe "allenatore" (role
    // data-value="all", nessun link nome) sono escluse esplicitamente.
    const byPlayer = new Map<string, string[]>();

    const rowRe = new RegExp(ROW_RE.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = rowRe.exec(html))) {
      const rowHtml = match[1]!;
      if (!rowHtml.includes('player-item cell')) continue;

      const roleMatch = ROLE_RE.exec(rowHtml);
      if (roleMatch?.[1] === 'all') continue; // riga allenatore, non un giocatore

      const nameMatch = NAME_RE.exec(rowHtml);
      if (!nameMatch) {
        throw new Error('Riga giocatore senza link nome riconoscibile (struttura pagina inattesa)');
      }
      const playerName = decodeHtmlEntities(nameMatch[1]!.trim());
      const codes = bonusCodesFromRow(rowHtml, playerName);
      codes.push(...deriveCardCodes(rowHtml));

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
      throw new Error('Nessun giocatore reale trovato nella pagina (struttura inattesa)');
    }

    return BonusImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdayNumber,
      players: [...byPlayer.entries()].map(([playerName, bonusCodes]) => ({ playerName, bonusCodes })),
    });
  }
}
