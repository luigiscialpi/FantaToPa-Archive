import { GoogleGenAI, Type } from '@google/genai';
import { aiAssistenteEnv } from './env';
import { PROMPT_GENERAZIONE_SQL, PROMPT_COMPOSIZIONE_RISPOSTA } from './prompt';

const ai = new GoogleGenAI({ apiKey: aiAssistenteEnv.GEMINI_API_KEY });

// Configurabile via variabile d'ambiente GEMINI_MODEL (vedere env.ts).
const MODELLO = aiAssistenteEnv.GEMINI_MODEL;

export interface RispostaGenerazioneSql {
  in_scope: boolean;
  sql: string | null;
  usa_contesto_utente: boolean;
}

/**
 * Errore lanciato quando la chiamata all'API Gemini fallisce per motivi
 * indipendenti dalla domanda (503 sovraccarico, 404 modello rimosso, rete,
 * timeout…). Distinto da QueryNonValidaError (SQL non valida) e da errori
 * applicativi: l'utente non deve riformulare la domanda ma riprovare più tardi.
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

/**
 * Wrappa le chiamate a @google/genai catturando gli errori dell'API (503, 404,
 * rete, ecc.) e rilanciandoli come GeminiApiError distinguibile dal resto.
 */
async function chiamaGemini<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    // @google/genai lancia un ApiError con proprietà .status (HTTP status code)
    // oppure con un message JSON che inizia con {"error":...}.
    const msg = e instanceof Error ? e.message : String(e);
    let statusCode: number | null = null;
    try {
      const parsed = JSON.parse(msg) as { error?: { code?: number } };
      statusCode = parsed?.error?.code ?? null;
    } catch {
      // messaggio non-JSON: lasciamo statusCode = null
    }
    throw new GeminiApiError(msg, statusCode);
  }
}

export async function generaSql(domandaUtente: string): Promise<RispostaGenerazioneSql> {
  const response = await chiamaGemini(() =>
    ai.models.generateContent({
      model: MODELLO,
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
    })
  );
  return JSON.parse(response.text ?? '{}') as RispostaGenerazioneSql;
}

export async function componiRisposta(
  domandaUtente: string,
  righeRisultato: unknown
): Promise<string> {
  const response = await chiamaGemini(() =>
    ai.models.generateContent({
      model: MODELLO,
      contents: `${PROMPT_COMPOSIZIONE_RISPOSTA}\n\nDomanda originale: "${domandaUtente}"\n\nRisultati (JSON): ${JSON.stringify(righeRisultato)}`,
    })
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
