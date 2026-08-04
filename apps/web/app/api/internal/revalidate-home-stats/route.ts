// apps/web/app/api/internal/revalidate-home-stats/route.ts
//
// Invalidazione on-demand della cache home-team-stats (vedi
// lib/queries/home-cache.ts), chiamata a fine import da
// packages/ingestion/lib/revalidate-web-cache.ts. Senza questa chiamata i
// dati si aggiornano comunque da soli entro HOME_STATS_REVALIDATE_SECONDS
// (1h) — questo endpoint serve solo a non dover aspettare.
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { HOME_STATS_TAG } from '../../../../lib/queries/home-cache';

// Confronto a tempo costante: un confronto diretto (`===`) su un segreto
// perderebbe tempo in modo proporzionale al prefisso corretto, un canale
// laterale sfruttabile per indovinarlo un carattere alla volta (OWASP).
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request): Promise<NextResponse> {
  const expectedSecret = process.env.REVALIDATE_SECRET;
  if (!expectedSecret) {
    // Fail closed: senza un segreto configurato l'endpoint non è utilizzabile
    // da nessuno, mai aperto "per errore" in un ambiente non configurato.
    return NextResponse.json({ error: 'Endpoint non configurato' }, { status: 500 });
  }

  const providedSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!providedSecret || !safeEqual(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  // Secondo argomento richiesto da Next 16 (profilo di cache-life del nuovo
  // valore dopo l'invalidazione): irrilevante per i tag creati da
  // unstable_cache (non dal nuovo "use cache"), 'max' è solo un placeholder
  // conservativo.
  revalidateTag(HOME_STATS_TAG, 'max');
  return NextResponse.json({ revalidated: true, tag: HOME_STATS_TAG });
}
