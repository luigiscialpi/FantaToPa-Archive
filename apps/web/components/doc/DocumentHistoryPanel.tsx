// apps/web/components/doc/DocumentHistoryPanel.tsx
//
// Storico versioni, solo admin (richiesta esplicita: "vedere chi ha
// modificato il file e quando"). Server Component puro: le signed URL di
// download sono già risolte dalla page (getDocumentVersionDownloadUrl),
// niente stato/JS necessario qui.
import { History, Download } from 'lucide-react';
import type { DocumentVersionRow } from '../../lib/queries/admin-documents';

type VersionWithUrl = DocumentVersionRow & { downloadUrl: string | null };

export function DocumentHistoryPanel({ versions }: { versions: VersionWithUrl[] }) {
  if (versions.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 rounded-lg border border-stone-200">
      <h2 className="flex items-center gap-1.5 px-4 py-3 text-sm font-bold text-stone-700 border-b border-stone-200">
        <History size={16} />
        Storico versioni ({versions.length})
      </h2>
      <ul className="divide-y divide-stone-100">
        {versions.map((version) => (
          <li key={version.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-stone-800">
                {version.source === 'upload' ? 'Caricamento file' : 'Modifica diretta'} — {version.createdByName}
              </p>
              <p className="text-xs text-stone-500">
                {new Date(version.createdAt).toLocaleString('it-IT', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {version.originalFilename ? ` — ${version.originalFilename}` : ''}
              </p>
            </div>
            {version.downloadUrl && (
              <a
                href={version.downloadUrl}
                className="inline-flex items-center gap-1 text-brand-700 font-semibold shrink-0"
              >
                <Download size={14} />
                Scarica
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
