// apps/web/lib/admin/user-actions.ts
//
// Gestione utenti (pannello admin Utenti): ruolo, squadra assegnata,
// eliminazione account. Stesso principio di admin/actions.ts — l'autorità
// vera è nella funzione Postgres (security definer, controlla is_admin() e
// solleva eccezione altrimenti), qui non si ripete il controllo.
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../supabase/server';

// Firma (userId, formData): userId è precaricato via .bind(null, userId) nel
// form della riga, formData porta il valore scelto nella select — stesso
// pattern di approve/rejectRegistration in admin/actions.ts, esteso di un
// argomento perché qui il form porta anche un valore, non solo un id.
export async function setUserRoleAction(userId: string, formData: FormData): Promise<void> {
  const newRole = formData.get('role');
  if (typeof newRole !== 'string') {
    throw new Error('Ruolo mancante.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_user_role', { target_user_id: userId, new_role: newRole });

  if (error) {
    throw new Error(`Impossibile cambiare il ruolo: ${error.message}`);
  }

  revalidatePath('/admin/utenti');
}

export async function setUserTeamAction(userId: string, formData: FormData): Promise<void> {
  const raw = formData.get('teamId');
  const newTeamId = typeof raw === 'string' && raw.length > 0 ? raw : null;

  const supabase = await createClient();
  // Il tipo generato per new_team_id non riflette la nullability SQL reale
  // (parametro uuid nullable): la funzione accetta null per "nessuna
  // squadra", il codegen Supabase lo tipizza comunque `string`.
  const { error } = await supabase.rpc('admin_set_user_team', {
    target_user_id: userId,
    new_team_id: newTeamId as unknown as string,
  });

  if (error) {
    throw new Error(`Impossibile riassegnare la squadra: ${error.message}`);
  }

  revalidatePath('/admin/utenti');
}

export async function deleteUserAction(userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId });

  if (error) {
    throw new Error(`Impossibile eliminare l'utente: ${error.message}`);
  }

  revalidatePath('/admin/utenti');
}
