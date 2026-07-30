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
