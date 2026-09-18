import { GoogleGenAI, Type } from '@google/genai';
import { aiAssistenteEnv } from './env';
import { PROMPT_GENERAZIONE_SQL, PROMPT_COMPOSIZIONE_RISPOSTA } from './prompt';

const ai = new GoogleGenAI({ apiKey: aiAssistenteEnv.GEMINI_API_KEY });

// gemini-3.5-flash è il modello raccomandato e stabilmente attivo senza 503 sovraccarico.
const MODELLO = 'gemini-3.5-flash';

export interface RispostaGenerazioneSql {
  in_scope: boolean;
  sql: string | null;
  usa_contesto_utente: boolean;
}

export async function generaSql(domandaUtente: string): Promise<RispostaGenerazioneSql> {
  const response = await ai.models.generateContent({
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
  });
  return JSON.parse(response.text ?? '{}') as RispostaGenerazioneSql;
}

export async function componiRisposta(
  domandaUtente: string,
  righeRisultato: unknown
): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODELLO,
    contents: `${PROMPT_COMPOSIZIONE_RISPOSTA}\n\nDomanda originale: "${domandaUtente}"\n\nRisultati (JSON): ${JSON.stringify(righeRisultato)}`,
  });
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
