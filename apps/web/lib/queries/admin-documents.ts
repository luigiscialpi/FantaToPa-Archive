// apps/web/lib/queries/admin-documents.ts
//
// Storico versioni (chi ha caricato/modificato un documento e quando) —
// admin-only, RLS document_versions_admin_only. Query diretta (non un RPC):
// created_by_name è già denormalizzato sulla riga, nessun join su profiles
// necessario (a differenza di admin_list_users, che deve leggere l'email
// solo presente in auth.users).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';
import type { DocumentKind } from './documents';

type TypedSupabaseClient = SupabaseClient<Database>;

export type DocumentVersionRow = {
  id: string;
  source: 'upload' | 'edit';
  originalFilename: string | null;
  storagePath: string | null;
  createdByName: string;
  createdAt: string;
};

export async function getDocumentVersions(
  supabase: TypedSupabaseClient,
  kind: DocumentKind,
): Promise<DocumentVersionRow[]> {
  const { data, error } = await supabase
    .from('document_versions')
    .select('id, source, original_filename, storage_path, created_by_name, created_at')
    .eq('kind', kind)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Impossibile leggere lo storico del documento "${kind}": ${error.message}`);
  }

  return data.map((row) => ({
    id: row.id,
    // source è vincolato dal check constraint DB a 'upload'|'edit'.
    source: row.source as 'upload' | 'edit',
    originalFilename: row.original_filename,
    storagePath: row.storage_path,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  }));
}

export async function getDocumentVersionDownloadUrl(
  supabase: TypedSupabaseClient,
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from('league-documents').createSignedUrl(storagePath, 60 * 5);
  if (error) {
    console.error(`Impossibile generare il link di download per ${storagePath}: ${error.message}`);
    return null;
  }
  return data.signedUrl;
}
