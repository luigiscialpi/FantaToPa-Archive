// apps/web/app/(protected)/doc/[kind]/page.tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '../../../../lib/supabase/server';
import { getSessionState } from '../../../../lib/auth/session';
import { getCurrentDocument, type DocumentKind } from '../../../../lib/queries/documents';
import { getDocumentVersions, getDocumentVersionDownloadUrl } from '../../../../lib/queries/admin-documents';
import { DocumentView } from '../../../../components/doc/DocumentView';
import { DocumentEditor } from '../../../../components/doc/DocumentEditor';
import { DocumentUploadButton } from '../../../../components/doc/DocumentUploadButton';
import { DocumentHistoryPanel } from '../../../../components/doc/DocumentHistoryPanel';
import { EditModeToggle } from '../../../../components/admin/EditModeToggle';

const VALID_KINDS: DocumentKind[] = ['storia', 'costituzione'];
const KIND_LABELS: Record<DocumentKind, string> = {
  storia: 'Storia della Lega',
  costituzione: 'Costituzione',
};

function isDocumentKind(value: string): value is DocumentKind {
  return (VALID_KINDS as string[]).includes(value);
}

type DocKindPageProps = {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ modifica?: string }>;
};

export async function generateMetadata({ params }: DocKindPageProps): Promise<Metadata> {
  const { kind } = await params;
  return isDocumentKind(kind) ? { title: KIND_LABELS[kind] } : {};
}

export default async function DocKindPage({ params, searchParams }: DocKindPageProps) {
  const { kind: kindParam } = await params;
  if (!isDocumentKind(kindParam)) {
    notFound();
  }
  const kind = kindParam;

  const { modifica } = await searchParams;
  const supabase = await createClient();
  const [session, document] = await Promise.all([getSessionState(), getCurrentDocument(supabase, kind)]);
  const isAdmin = session.kind === 'autenticato' && session.profile.role === 'admin';
  const editMode = isAdmin && modifica === '1';

  const versions = isAdmin ? await getDocumentVersions(supabase, kind) : [];
  const versionsWithUrls = await Promise.all(
    versions.map(async (version) => ({
      ...version,
      downloadUrl: version.storagePath ? await getDocumentVersionDownloadUrl(supabase, version.storagePath) : null,
    })),
  );

  return (
    <main className="p-4 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-serif font-bold text-xl text-brand-950">{KIND_LABELS[kind]}</h1>
          {document.updatedByName && (
            <p className="text-xs text-stone-500">
              Ultimo aggiornamento:{' '}
              {new Date(document.updatedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })} —{' '}
              {document.updatedByName}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            <DocumentUploadButton kind={kind} />
            <EditModeToggle active={editMode} />
          </div>
        )}
      </div>

      {editMode ? <DocumentEditor kind={kind} initialHtml={document.contentHtml} /> : <DocumentView html={document.contentHtml} />}

      {isAdmin && <DocumentHistoryPanel versions={versionsWithUrls} />}
    </main>
  );
}
