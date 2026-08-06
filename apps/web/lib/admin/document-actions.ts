// apps/web/lib/admin/document-actions.ts
//
// Upload (.docx -> HTML via mammoth) e modifica diretta (Tiptap) per la
// pagina Doc (Storia/Costituzione). Stesso principio delle altre server
// action di editing admin (Formazioni/Classifica/Calendario/Rose): nessuna
// funzione security definer, la RLS write-admin già esistente su
// `documents`/`document_versions`/storage `league-documents` è la sola
// autorità.
//
// Sia l'upload sia la modifica diretta producono UNA riga in
// document_versions (unica fonte di "chi ha modificato/caricato e quando"):
// non due meccanismi di audit separati.
'use server';

import { revalidatePath } from 'next/cache';
import mammoth from 'mammoth';
import { createClient } from '../supabase/server';
import { getSessionState } from '../auth/session';
import { logAdminEdit } from './audit';
import type { DocumentKind } from '../queries/documents';

// Richiesta esplicita utente: retention diversa per documento (20 vs 5), non
// un unico numero condiviso.
const RETENTION_LIMIT: Record<DocumentKind, number> = {
  storia: 20,
  costituzione: 5,
};

function adminName(profile: { firstName: string | null; lastName: string | null; email: string | null }): string {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  return fullName || profile.email || 'Admin';
}

async function requireAdminProfile() {
  const session = await getSessionState();
  if (session.kind !== 'autenticato' || session.profile.role !== 'admin') {
    throw new Error('Solo admin può modificare questo documento.');
  }
  return session.profile;
}

// Elimina, per un dato kind, le versioni oltre il limite di retention — sia
// la riga in document_versions sia (quando presente) il file originale in
// Storage. Best-effort sul lato Storage: un file orfano non deve mai
// bloccare la pubblicazione della nuova versione già avvenuta.
async function pruneOldVersions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: DocumentKind,
): Promise<void> {
  const limit = RETENTION_LIMIT[kind];
  const { data: toPrune, error } = await supabase
    .from('document_versions')
    .select('id, storage_path')
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .range(limit, limit + 999);

  if (error || !toPrune || toPrune.length === 0) {
    return;
  }

  const storagePaths = toPrune.map((v) => v.storage_path).filter((path): path is string => path !== null);
  if (storagePaths.length > 0) {
    const { error: removeError } = await supabase.storage.from('league-documents').remove(storagePaths);
    if (removeError) {
      console.error(`Impossibile rimuovere file originali potati per "${kind}": ${removeError.message}`);
    }
  }

  const { error: deleteError } = await supabase
    .from('document_versions')
    .delete()
    .in('id', toPrune.map((v) => v.id));
  if (deleteError) {
    console.error(`Impossibile eliminare versioni potate per "${kind}": ${deleteError.message}`);
  }
}

async function publishVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    kind: DocumentKind;
    contentHtml: string;
    source: 'upload' | 'edit';
    adminUserId: string;
    adminName: string;
    originalFilename?: string;
    storagePath?: string;
  },
): Promise<void> {
  const { error: upsertError } = await supabase.from('documents').upsert({
    kind: params.kind,
    content_html: params.contentHtml,
    updated_at: new Date().toISOString(),
    updated_by: params.adminUserId,
    updated_by_name: params.adminName,
  });
  if (upsertError) {
    throw new Error(`Impossibile salvare il documento: ${upsertError.message}`);
  }

  const { data: version, error: versionError } = await supabase
    .from('document_versions')
    .insert({
      kind: params.kind,
      content_html: params.contentHtml,
      source: params.source,
      original_filename: params.originalFilename ?? null,
      storage_path: params.storagePath ?? null,
      created_by: params.adminUserId,
      created_by_name: params.adminName,
    })
    .select('id')
    .single();
  if (versionError) {
    throw new Error(`Impossibile registrare la versione: ${versionError.message}`);
  }

  await logAdminEdit(supabase, {
    adminUserId: params.adminUserId,
    tableName: 'documents',
    rowId: null,
    action: 'update',
    before: null,
    after: { kind: params.kind, source: params.source, versionId: version.id },
  });

  await pruneOldVersions(supabase, params.kind);
}

export async function uploadDocumentVersionAction(kind: DocumentKind, formData: FormData): Promise<void> {
  const profile = await requireAdminProfile();
  const file = formData.get('file');

  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.docx')) {
    throw new Error('Carica un file .docx (il vecchio formato .doc non è supportato).');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { value: contentHtml } = await mammoth.convertToHtml({ buffer });

  const supabase = await createClient();
  const storagePath = `${kind}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from('league-documents').upload(storagePath, buffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  if (uploadError) {
    throw new Error(`Impossibile caricare il file: ${uploadError.message}`);
  }

  await publishVersion(supabase, {
    kind,
    contentHtml,
    source: 'upload',
    adminUserId: profile.userId,
    adminName: adminName(profile),
    originalFilename: file.name,
    storagePath,
  });

  revalidatePath('/doc/[kind]', 'page');
}

export async function updateDocumentContentAction(kind: DocumentKind, contentHtml: string): Promise<void> {
  const profile = await requireAdminProfile();
  const supabase = await createClient();

  await publishVersion(supabase, {
    kind,
    contentHtml,
    source: 'edit',
    adminUserId: profile.userId,
    adminName: adminName(profile),
  });

  revalidatePath('/doc/[kind]', 'page');
}
