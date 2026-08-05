// apps/web/lib/admin/audit.ts
//
// Log di audit condiviso da tutte le server action di editing admin
// (Utenti, e ora Formazioni/Classifica/Calendario/Rose) — tabella
// admin_edits, vedi 20260805100000_admin_user_management.sql.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@fantatopa/shared-types/database';

type TypedSupabaseClient = SupabaseClient<Database>;

export async function logAdminEdit(
  supabase: TypedSupabaseClient,
  params: {
    adminUserId: string;
    tableName: string;
    rowId: string | null;
    action: 'insert' | 'update' | 'delete';
    before: Json;
    after: Json;
  },
): Promise<void> {
  const { error } = await supabase.from('admin_edits').insert({
    admin_user_id: params.adminUserId,
    table_name: params.tableName,
    row_id: params.rowId,
    action: params.action,
    before: params.before,
    after: params.after,
  });

  // Un fallimento dell'audit log non deve mai far fallire la modifica reale
  // già avvenuta: solo un log a console, non un'eccezione.
  if (error) {
    console.error(`Impossibile registrare l'audit log per ${params.tableName}: ${error.message}`);
  }
}
