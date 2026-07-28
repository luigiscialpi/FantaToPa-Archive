// apps/web/proxy.ts
//
// Rinnova il cookie di sessione Supabase ad ogni richiesta: i Server
// Component non possono scrivere cookie, quindi serve questo livello per
// aggiornare il token quando scade. Il controllo vero e proprio di
// autenticazione/approvazione resta nel layout protetto (getSessionState),
// qui c'è solo il refresh — per questo il matcher è ampio ma leggero.
//
// Nota: "proxy.ts" è il nome corrente di quello che prima si chiamava
// "middleware.ts" (rinominato in Next.js 16, stessa funzione).
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from './lib/supabase/env';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Il risultato non serve qui: la sola cosa che ci interessa è l'effetto
  // collaterale del refresh (scrittura dei cookie aggiornati in `response`).
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
