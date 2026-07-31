// apps/web/lib/admin/actions.ts
//
// Approvazione/rifiuto richieste di registrazione (sezione 9 del piano).
// L'autorizzazione vera è nella funzione Postgres (security definer,
// controlla is_admin() ed esplode altrimenti) — qui non si ripete il
// controllo, sarebbe uno strato di fiducia in più senza aggiungere sicurezza
// reale: il layout admin (admin/layout.tsx) blocca comunque l'accesso alla
// pagina da cui questi action vengono invocati.
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../supabase/server';
import { getSessionState } from '../auth/session';
import { siteOrigin } from '../auth/actions';

export async function approveRegistration(requestId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_registration', { request_id: requestId });

  if (error) {
    throw new Error(`Impossibile approvare la richiesta: ${error.message}`);
  }

  revalidatePath('/admin/registrazioni');
}

export async function rejectRegistration(requestId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_registration', { request_id: requestId });

  if (error) {
    throw new Error(`Impossibile rifiutare la richiesta: ${error.message}`);
  }

  revalidatePath('/admin/registrazioni');
}

export type ResendConfirmationState = { error: string | null; success: boolean };

// A differenza di approve/rejectRegistration, qui non c'è una funzione
// Postgres security definer a fare da vera barriera d'autorizzazione:
// supabase.auth.resend() non ha nozione di "admin", quindi il controllo
// del ruolo va fatto qui invece di fidarsi solo del gate della pagina
// (un Server Action resta invocabile direttamente, a prescindere dalla UI).
export async function resendConfirmationEmail(
  _prevState: ResendConfirmationState,
  formData: FormData,
): Promise<ResendConfirmationState> {
  const session = await getSessionState();
  if (session.kind !== 'autenticato' || session.profile.role !== 'admin') {
    return { error: 'Non autorizzato.', success: false };
  }

  const email = formData.get('email');
  if (typeof email !== 'string' || !email) {
    return { error: "Inserisci un'email.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: await siteOrigin() },
  });

  if (error) {
    return { error: error.message, success: false };
  }

  return { error: null, success: true };
}
