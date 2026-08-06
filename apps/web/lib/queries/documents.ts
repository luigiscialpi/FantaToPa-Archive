// apps/web/lib/queries/documents.ts
//
// Pagina "Doc" (Storia/Costituzione): `documents` è la sola riga corrente
// per kind, letta da chiunque possa leggere dati di lega (RLS
// documents_select_approved). Lo storico (`document_versions`, chi ha
// caricato/modificato e quando) è admin-only e vive in lib/admin/documents.ts
// con le server action, non qui — questo file resta la query pubblica.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';

type TypedSupabaseClient = SupabaseClient<Database>;

export type DocumentKind = 'storia' | 'costituzione';

export type CurrentDocument = {
  kind: DocumentKind;
  contentHtml: string;
  updatedAt: string;
  updatedByName: string | null;
};

export async function getCurrentDocument(
  supabase: TypedSupabaseClient,
  kind: DocumentKind,
): Promise<CurrentDocument> {
  const { data, error } = await supabase
    .from('documents')
    .select('kind, content_html, updated_at, updated_by_name')
    .eq('kind', kind)
    .single();

  if (error) {
    throw new Error(`Impossibile leggere il documento "${kind}": ${error.message}`);
  }

  return {
    kind,
    contentHtml: data.content_html,
    updatedAt: data.updated_at,
    updatedByName: data.updated_by_name,
  };
}
