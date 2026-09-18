import { GoogleGenAI, Type } from '@google/genai';
import { aiAssistenteEnv } from './env';
import { PROMPT_GENERAZIONE_SQL, PROMPT_COMPOSIZIONE_RISPOSTA } from './prompt';

const ai = new GoogleGenAI({ apiKey: aiAssistenteEnv.GEMINI_API_KEY });

// Catena ordinata di modelli (configurati + fallback gratuiti).
const CATENA_MODELLI = aiAssistenteEnv.CATENA_MODELLI;

export interface RispostaGenerazioneSql {
  in_scope: boolean;
  sql: string | null;
  usa_contesto_utente: boolean;
  modello_usato?: string;
}

/**
 * Errore lanciato quando la chiamata all'API Gemini fallisce per motivi
 * indipendenti dalla domanda (503 sovraccarico, 404 modello rimosso, rete,
 * quota 429 esaurita su tutti i modelli…). Distinto da QueryNonValidaError.
 */
export class GeminiApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null = null
  ) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

interface ErroreGeminiDettagli {
  statusCode: number | null;
  message: string;
}

function estraiDettagliErrore(e: unknown): ErroreGeminiDettagli {
  const msg = e instanceof Error ? e.message : String(e);
  let statusCode: number | null = null;

  if (typeof (e as { status?: unknown })?.status === 'number') {
    statusCode = (e as { status: number }).status;
  } else {
    try {
      const parsed = JSON.parse(msg) as { error?: { code?: number } };
      statusCode = parsed?.error?.code ?? null;
    } catch {
      const match = msg.match(/\b(429|503|500|502|504|404)\b/);
      if (match?.[1]) statusCode = parseInt(match[1], 10);
    }
  }

  return { statusCode, message: msg };
}

/**
 * Determina se l'errore è recuperabile provando un altro modello gratuito:
 * - 429: Quota o rate limit esaurito su quel modello specifico
 * - 503: Modello sovraccarico
 * - 404: Modello rimosso o deprecato
 * - 500, 502, 504: Errori temporanei lato server
 * - Stringhe diagnostiche di esaurimento risorsa/quota
 */
function eErroreRecuperabileConFallback(err: ErroreGeminiDettagli): boolean {
  const { statusCode, message } = err;
  if (
    statusCode === 429 ||
    statusCode === 503 ||
    statusCode === 404 ||
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 504
  ) {
    return true;
  }

  const lower = message.toLowerCase();
  return (
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable')
  );
}

/**
 * Esegue un'operazione con l'API Gemini provando la catena di modelli gratuiti.
 * Se un modello ha la quota esaurita (429) o non è temporaneamente disponibile (503/404),
 * passa automaticamente al modello successivo nella catena.
 */
async function chiamaGeminiConFallback<T>(
  fn: (modello: string) => Promise<T>,
  catena: string[] = CATENA_MODELLI
): Promise<{ data: T; modelloUsato: string }> {
  const errori: { modello: string; errore: string }[] = [];
  const lista = catena.length > 0 ? catena : CATENA_MODELLI;

  for (let i = 0; i < lista.length; i++) {
    const modello = lista[i];
    if (!modello) continue;
    const isUltimo = i === lista.length - 1;

    try {
      const data = await fn(modello);
      if (i > 0) {
        console.warn(
          `[gemini-client] Modello precedente non disponibile, fallback riuscito con ${modello}.`
        );
      }
      return { data, modelloUsato: modello };
    } catch (e) {
      const info = estraiDettagliErrore(e);
      errori.push({ modello, errore: `[${info.statusCode ?? 'err'}] ${info.message}` });

      const prossimoModello = lista[i + 1];
      if (eErroreRecuperabileConFallback(info) && !isUltimo && prossimoModello) {
        console.warn(
          `[gemini-client] Modello ${modello} non disponibile (${info.statusCode ?? info.message}). Fallback su ${prossimoModello}...`
        );
        continue;
      }

      // Errore non recuperabile o tutti i modelli hanno fallito
      const dettaglio = errori.map((x) => `${x.modello}: ${x.errore}`).join('; ');
      throw new GeminiApiError(
        `Tutti i modelli gratuiti configurati hanno fallito. Dettagli: ${dettaglio}`,
        info.statusCode
      );
    }
  }

  throw new GeminiApiError('Nessun modello configurato per l\'assistente IA.');
}

export async function generaSql(
  domandaUtente: string,
  catenaModelli?: string[]
): Promise<RispostaGenerazioneSql> {
  const { data: response, modelloUsato } = await chiamaGeminiConFallback(
    (modello) =>
      ai.models.generateContent({
        model: modello,
        contents: `${PROMPT_GENERAZIONE_SQL}\n\nDomanda dell'utente: "${domandaUtente}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              in_scope: { type: Type.BOOLEAN },
              sql: { type: Type.STRING, nullable: true },
              usa_contesto_utente: { type: Type.BOOLEAN },
            },
            required: ['in_scope', 'sql', 'usa_contesto_utente'],
          },
        },
      }),
    catenaModelli
  );

  const parsed = JSON.parse(response.text ?? '{}') as RispostaGenerazioneSql;
  return {
    ...parsed,
    modello_usato: modelloUsato,
  };
}

export async function componiRisposta(
  domandaUtente: string,
  righeRisultato: unknown,
  catenaModelli?: string[]
): Promise<string> {
  const { data: response } = await chiamaGeminiConFallback(
    (modello) =>
      ai.models.generateContent({
        model: modello,
        contents: `${PROMPT_COMPOSIZIONE_RISPOSTA}\n\nDomanda originale: "${domandaUtente}"\n\nRisultati (JSON): ${JSON.stringify(righeRisultato)}`,
      }),
    catenaModelli
  );
  return response.text ?? 'Non sono riuscito a formulare una risposta.';
}

export class IdentitaUtenteMancanteError extends Error {}

/**
 * Sostituisce il placeholder CURRENT_TEAM_ID con il vero team_id dell'utente.
 * Decide SOLO in base a se il placeholder compare davvero nel testo della SQL,
 * non in base al flag usa_contesto_utente restituito da Gemini: i due possono
 * essere in disaccordo (il modello dichiara true/false in modo incoerente con
 * quello che ha effettivamente scritto), e questa funzione deve comportarsi
 * bene in entrambi i casi senza che nessuno debba prevederli a mano.
 */
export function risolviIdentitaUtente(sql: string, teamId: string | null): string {
  if (!sql.includes('CURRENT_TEAM_ID')) {
    return sql; // placeholder assente: nessuna sostituzione da fare, non-op sicuro
  }
  if (!teamId) {
    // profiles.team_id è opzionale (un admin senza squadra propria, o un
    // membro appena approvato non ancora assegnato). Eseguire con il
    // placeholder non sostituito romperebbe la sintassi SQL; sostituirlo con
    // NULL darebbe zero righe travestite da risposta valida. Meglio fermarsi
    // qui con un errore esplicito e distinguibile dagli altri.
    throw new IdentitaUtenteMancanteError();
  }
  // teamId arriva SEMPRE da profiles.team_id via sessione verificata
  // (getSessionState() del Passo 8), mai dal testo della domanda: per questo
  // l'interpolazione diretta della stringa qui è sicura.
  return sql.replaceAll('CURRENT_TEAM_ID', `'${teamId}'`);
}
