// apps/web/app/api/assistente/ping/route.ts
//
// Endpoint admin-only per verificare rapidamente che l'IA risponda.
// Invia una domanda fissa banale (in-scope, senza CURRENT_TEAM_ID, sempre
// valida) e restituisce latenza + modello usato. Non logga in
// query_assistant_logs: è un test di diagnostica, non una richiesta utente.
import { NextResponse } from 'next/server';
import { getSessionState } from '../../../../lib/auth/session';
import { generaSql } from '../../../../lib/ai-assistente/gemini-client';
import { aiAssistenteEnv } from '../../../../lib/ai-assistente/env';

const DOMANDA_TEST = 'Quante stagioni sono archiviate?';

export async function GET(): Promise<NextResponse> {
  const session = await getSessionState();
  if (session.kind !== 'autenticato' || session.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const inizio = Date.now();
  try {
    const risultato = await generaSql(DOMANDA_TEST);
    const latenzaMs = Date.now() - inizio;
    return NextResponse.json({
      ok: true,
      modello: aiAssistenteEnv.GEMINI_MODEL,
      latenzaMs,
      inScope: risultato.in_scope,
      sqlGenerata: risultato.sql,
    });
  } catch (e) {
    const latenzaMs = Date.now() - inizio;
    const messaggio = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        modello: aiAssistenteEnv.GEMINI_MODEL,
        latenzaMs,
        errore: messaggio,
      },
      { status: 200 } // 200 intenzionale: il ping stesso ha funzionato, l'IA no
    );
  }
}
