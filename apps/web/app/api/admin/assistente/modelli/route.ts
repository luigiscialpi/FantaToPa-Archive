// apps/web/app/api/admin/assistente/modelli/route.ts
//
// Endpoint per visualizzare e aggiornare la configurazione dei modelli Gemini.
// Solo per admin.
import { NextResponse } from 'next/server';
import { getSessionState } from '../../../../../lib/auth/session';
import { createClient } from '../../../../../lib/supabase/server';
import { getCatenaModelliAttiva, salvaCatenaModelli } from '../../../../../lib/ai-assistente/settings';
import { scopriModelliGoogle } from '../../../../../lib/ai-assistente/models-discovery';

export async function GET(): Promise<NextResponse> {
  const session = await getSessionState();
  if (session.kind !== 'autenticato' || session.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const supabase = await createClient();
  const catenaAttiva = await getCatenaModelliAttiva(supabase);

  try {
    const modelliDisponibili = await scopriModelliGoogle();
    return NextResponse.json({
      ok: true,
      catenaAttiva,
      modelliDisponibili,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      catenaAttiva,
      modelliDisponibili: [],
      errore: `Impossibile interrogare Google API: ${msg}`,
    });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSessionState();
  if (session.kind !== 'autenticato' || session.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const supabase = await createClient();

  try {
    const body = await request.json().catch(() => null);
    const models = Array.isArray(body?.models)
      ? (body.models as unknown[]).filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      : [];

    if (models.length === 0) {
      return NextResponse.json(
        { error: 'Specificare almeno un modello nella catena' },
        { status: 400 }
      );
    }

    await salvaCatenaModelli(supabase, models, session.profile.userId);

    return NextResponse.json({
      ok: true,
      catenaAttiva: models,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
