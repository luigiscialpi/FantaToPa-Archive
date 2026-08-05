// packages/ingestion/adapters/html-legacy/decode.ts
//
// Le pagine del mirror "Leghe Fantagazzetta" (stagione 2018-19, unica fonte
// HTML legacy finora) incorporano i dati in variabili globali JS, non in
// JSON-LD o tag <script type="application/json">:
//   __.s('KEY', __.dp('BASE64'))   -> BASE64 è JSON compresso/offuscato
//   __.s('KEY', { ...oggetto... }) -> oggetto letterale con sintassi JSON
//                                     valida (chiavi/stringhe fra doppi apici)
// Estrarre questi valori richiede di trovare il marker `__.s('KEY', ` nel
// testo grezzo e poi isolare il valore che segue — non un parser HTML
// generico (non serve: sono poche chiavi note, sempre nello stesso formato).
import { z } from 'zod';

export function extractDpBlob(html: string, key: string): string {
  const marker = `__.s('${key}', __.dp('`;
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`Chiave "${key}" (__.dp) non trovata`);
  const contentStart = start + marker.length;
  const end = html.indexOf(`'`, contentStart);
  if (end === -1) throw new Error(`Chiusura base64 non trovata per la chiave "${key}"`);
  return Buffer.from(html.slice(contentStart, end), 'base64').toString('utf-8');
}

// Estrae un oggetto {...} bilanciato subito dopo `__.s('KEY', `, rispettando
// le stringhe fra doppi apici (e i relativi escape) così una `}` dentro un
// valore stringa non chiude il blocco troppo presto.
export function extractBalancedObject(html: string, key: string): string {
  const marker = `__.s('${key}', `;
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`Chiave "${key}" (oggetto letterale) non trovata`);
  const openIdx = start + marker.length;
  if (html[openIdx] !== '{') {
    throw new Error(`Atteso '{' dopo la chiave "${key}", trovato: ${html.slice(openIdx, openIdx + 20)}`);
  }
  let depth = 0;
  let inString = false;
  for (let i = openIdx; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (ch === '\\') { i++; continue; } // salta il carattere dopo l'escape
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return html.slice(openIdx, i + 1);
    }
  }
  throw new Error(`Blocco oggetto non bilanciato per la chiave "${key}"`);
}

// Set chiuso osservato nelle pagine 2018-19 (nomi giocatore/squadra): non un
// decoder HTML entity generico, solo queste 6 note. Se ne compare una nuova,
// meglio un errore leggibile a valle (carattere "&...;" visibile nel dato)
// che indovinare una tabella entità completa mai verificata su questa fonte.
const KNOWN_ENTITIES: Record<string, string> = {
  '&#039;': "'",
  '&#39;': "'",
  '&#232;': 'è',
  '&#242;': 'ò',
  '&amp;': '&',
  '&quot;': '"',
  '&times;': '×',
};

// Oltre alla tabella fissa (entità nominali), decodifica genericamente le
// entità numeriche `&#N;`/`&#xHEX;` — coprono qualunque carattere accentato o
// punteggiatura, senza dover elencare ogni codepoint mai incontrato (visto
// mancare per `&#x27;`, apostrofo esadecimale, in fantacalcio-it/bonus.ts:
// faceva fallire silenziosamente la risoluzione di "Montipò" per l'intera
// stagione, mai un errore visibile perché il nome semplicemente non
// matchava nessun alias).
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&#x([0-9a-fA-F]+);|&#(\d+);|&\w+;/g, (match, hex, dec) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (dec) return String.fromCodePoint(parseInt(dec, 10));
    return KNOWN_ENTITIES[match] ?? match;
  });
}

// Il testo visibile nelle tabelle rose*.html è tutto minuscolo (stilizzato
// via CSS "capitalize"). Titolarizza parola per parola, gestendo l'apostrofo
// come separatore aggiuntivo (es. "d'alessandro" -> "D'Alessandro").
export function titleCase(text: string): string {
  return text
    .split(' ')
    .map((word) =>
      word
        .split("'")
        .map((piece) => (piece.length > 0 ? piece[0]!.toUpperCase() + piece.slice(1).toLowerCase() : piece))
        .join("'"),
    )
    .join(' ');
}

// Blob squadra ("lt"), presente identico su classifica/calendario/rose di
// ogni competizione: id/nome sempre popolati; calciatori/costi (elenchi
// separati da ";", stesso ordine) e crediti residui servono solo alla rosa
// d'asta (roster.ts). Non validiamo gli altri campi (branding, ruoli
// aggregati...): non ci servono e non sono garantiti stabili.
const HtmlLegacyTeamBlobSchema = z.object({
  id: z.number(),
  nome: z.string().min(1),
  calciatori: z.string(),
  costi: z.string(),
  crediti: z.number(),
});
export type HtmlLegacyTeamBlob = z.infer<typeof HtmlLegacyTeamBlobSchema>;

const HtmlLegacyTeamDataSchema = z.object({ data: z.array(HtmlLegacyTeamBlobSchema) });

// Presente sia su classifica.html che su calendario.html/rose.html di ogni
// competizione (stesso contenuto, verificato su Campionato e Coppa Girone B).
export function extractTeamBlobs(html: string): HtmlLegacyTeamBlob[] {
  const raw = JSON.parse(extractDpBlob(html, 'lt'));
  return HtmlLegacyTeamDataSchema.parse(raw).data;
}

export function teamNameById(teams: HtmlLegacyTeamBlob[]): Map<number, string> {
  return new Map(teams.map((t) => [t.id, t.nome.trim()]));
}
