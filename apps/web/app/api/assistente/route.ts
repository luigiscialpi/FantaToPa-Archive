import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSessionState, canReadLeagueData } from '../../../lib/auth/session';
import { createClient } from '../../../lib/supabase/server';
import {
  generaSql,
  componiRisposta,
  risolviIdentitaUtente,
  IdentitaUtenteMancanteError,
  GeminiApiError,
} from '../../../lib/ai-assistente/gemini-client';
import { validaEWrappa, QueryNonValidaError } from '../../../lib/ai-assistente/sql-validator';
import { getCatenaModelliAttiva } from '../../../lib/ai-assistente/settings';

const MASSIMO_TENTATIVI = 2;
const LUNGHEZZA_MASSIMA_DOMANDA = 500;

// Le uniche cinque stringhe che il browser vede in caso di mancata risposta.
// Qualunque dettaglio tecnico (SQL generata, messaggio Postgres, stack trace)
// resta nel log, mai nella risposta HTTP.
type TipoErrore =
  | 'fuori_tema'
  | 'identita_mancante'
  | 'non_generabile'
  | 'errore_servizio_ia'
  | 'errore_temporaneo';

const MESSAGGI_ERRORE: Record<TipoErrore, string> = {
  fuori_tema: 'Questa domanda non riguarda le statistiche della lega, quindi non posso rispondere.',
  identita_mancante:
    'Il tuo profilo non ha una squadra associata: non posso rispondere a domande sulla "tua squadra".',
  non_generabile:
    'Non sono riuscito a generare una risposta valida per questa domanda. Prova a riformularla in modo più specifico.',
  // Errore che non dipende dalla domanda (503 sovraccarico, 404 modello rimosso,
  // rete): l'utente non deve riformulare nulla, deve solo riprovare più tardi.
  errore_servizio_ia:
    "Il servizio di intelligenza artificiale non è al momento disponibile. Non è un problema con la domanda: riprova tra qualche minuto.",
  errore_temporaneo: 'Si è verificato un problema temporaneo. Riprova tra poco.',
};

export async function POST(request: Request): Promise<NextResponse> {
  const inizio = Date.now();
  const richiestaId = randomUUID();

  // Gate reale: i route handler NON ereditano il layout di (protected)/,
  // quindi questo controllo va ripetuto qui esplicitamente — non è ridondante.
  const session = await getSessionState();
  if (session.kind === 'anonimo' || !canReadLeagueData(session.profile)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  const { profile } = session;
  const supabase = await createClient(); // sessione utente reale, RLS attiva, mai service role
  const catenaModelli = await getCatenaModelliAttiva(supabase);

  try {
    const body = await request.json().catch(() => null);
    const domanda = typeof body?.domanda === 'string' ? body.domanda.trim() : '';
    if (!domanda || domanda.length > LUNGHEZZA_MASSIMA_DOMANDA) {
      return NextResponse.json({ error: 'Domanda mancante o troppo lunga' }, { status: 400 });
    }

    let ultimoErrore = '';
    for (let tentativo = 1; tentativo <= MASSIMO_TENTATIVI; tentativo++) {
      let sqlGenerata: string | null = null;
      try {
        const generazione = await generaSql(
          tentativo === 1
            ? domanda
            : `${domanda}\n\n(Il tentativo precedente ha prodotto una query non valida: ${ultimoErrore}. Correggi.)`,
          catenaModelli
        );

        if (!generazione.in_scope) {
          await registraLog(
            supabase,
            richiestaId,
            tentativo,
            profile.userId,
            domanda,
            null,
            'fuori_tema',
            null,
            Date.now() - inizio,
            null
          );
          return NextResponse.json({
            risposta: MESSAGGI_ERRORE.fuori_tema,
            tipoErrore: 'fuori_tema' as TipoErrore,
          });
        }

        sqlGenerata = generazione.sql ?? '';
        const sqlConIdentita = risolviIdentitaUtente(sqlGenerata, profile.teamId ?? null);
        const sqlValidata = validaEWrappa(sqlConIdentita);

        const { data: righe, error } = await supabase.rpc('execute_readonly_query', {
          query_text: sqlValidata,
        });
        if (error) throw new QueryNonValidaError(error.message);

        const risposta = await componiRisposta(domanda, righe, catenaModelli);
        await registraLog(
          supabase,
          richiestaId,
          tentativo,
          profile.userId,
          domanda,
          sqlValidata,
          'accettata',
          null,
          Date.now() - inizio,
          Array.isArray(righe) ? righe.length : 0
        );

        return NextResponse.json({ risposta, righe, sql: sqlValidata });
      } catch (e) {
        if (e instanceof IdentitaUtenteMancanteError) {
          await registraLog(
            supabase,
            richiestaId,
            tentativo,
            profile.userId,
            domanda,
            sqlGenerata,
            'rifiutata',
            'team_id mancante',
            Date.now() - inizio,
            null
          );
          return NextResponse.json({
            risposta: MESSAGGI_ERRORE.identita_mancante,
            tipoErrore: 'identita_mancante' as TipoErrore,
          });
        }

        // GeminiApiError: 503, 404 modello rimosso, rete — non è colpa della
        // domanda, non ha senso ritentare né dire all'utente di riformulare.
        if (e instanceof GeminiApiError) {
          await registraLog(
            supabase,
            richiestaId,
            tentativo,
            profile.userId,
            domanda,
            sqlGenerata,
            'errore_interno',
            `GeminiApiError [${e.statusCode ?? 'no-status'}]: ${e.message}`,
            Date.now() - inizio,
            null
          );
          return NextResponse.json({
            risposta: MESSAGGI_ERRORE.errore_servizio_ia,
            tipoErrore: 'errore_servizio_ia' as TipoErrore,
          });
        }

        ultimoErrore = e instanceof Error ? e.message : String(e);
        // Ogni tentativo va loggato, non solo l'ultimo: leggendo il log dopo
        // vuoi vedere se Gemini ha ripetuto lo stesso errore al secondo giro
        // o ne ha fatto uno diverso.
        await registraLog(
          supabase,
          richiestaId,
          tentativo,
          profile.userId,
          domanda,
          sqlGenerata,
          'rifiutata',
          ultimoErrore,
          Date.now() - inizio,
          null
        );
      }
    }

    return NextResponse.json({
      risposta: MESSAGGI_ERRORE.non_generabile,
      tipoErrore: 'non_generabile' as TipoErrore,
    });
  } catch (e) {
    // Qui arriva solo ciò che NON era previsto dal disegno sopra: un bug, Gemini
    // irraggiungibile, Supabase giù. Il developer ha bisogno del massimo
    // dettaglio possibile (messaggio + stack trace) nel log; l'utente vede solo
    // il messaggio generico — mai lo stack trace nella risposta HTTP.
    const dettaglio = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
    await registraLog(
      supabase,
      richiestaId,
      0,
      profile.userId,
      '(errore prima o durante la lettura della domanda)',
      null,
      'errore_interno',
      dettaglio,
      Date.now() - inizio,
      null
    ).catch(() => {}); // se anche il log fallisce, non bloccare comunque la risposta all'utente
    return NextResponse.json({
      risposta: MESSAGGI_ERRORE.errore_temporaneo,
      tipoErrore: 'errore_temporaneo' as TipoErrore,
    });
  }
}

async function registraLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  richiestaId: string,
  tentativo: number,
  userId: string,
  domanda: string,
  sqlGenerata: string | null,
  esito: 'accettata' | 'rifiutata' | 'fuori_tema' | 'errore_interno',
  motivoRifiuto: string | null,
  latenzaMs: number,
  righeRestituite: number | null
) {
  await supabase.from('query_assistant_logs').insert({
    richiesta_id: richiestaId,
    tentativo,
    user_id: userId,
    domanda,
    sql_generata: sqlGenerata,
    esito,
    motivo_rifiuto: motivoRifiuto,
    latenza_ms: latenzaMs,
    righe_restituite: righeRestituite,
  });
}
