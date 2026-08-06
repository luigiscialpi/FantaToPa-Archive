// apps/web/components/doc/DocumentUploadButton.tsx
//
// Upload .docx con anteprima prima di confermare (richiesta esplicita):
// la conversione viene fatta DUE volte con la stessa libreria (mammoth) —
// una volta qui nel browser (mammoth ha una build browser, risolta
// automaticamente dal campo "browser" del package.json quando bundlato per
// il client) solo per mostrare l'anteprima, e una seconda volta lato server
// dentro uploadDocumentVersionAction, che è la sola versione persistita.
// Non ci si fida mai dell'HTML generato lato client per lo storage: solo
// per la UI di anteprima.
'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { uploadDocumentVersionAction } from '../../lib/admin/document-actions';
import type { DocumentKind } from '../../lib/queries/documents';

export function DocumentUploadButton({ kind }: { kind: DocumentKind }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith('.docx')) {
      setError('Carica un file .docx (il vecchio formato .doc non è supportato).');
      dialogRef.current?.showModal();
      return;
    }

    setError(null);
    setFile(selected);
    const mammoth = await import('mammoth');
    const arrayBuffer = await selected.arrayBuffer();
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
    setPreviewHtml(html);
    dialogRef.current?.showModal();
  }

  async function handleConfirm() {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('file', file);
      await uploadDocumentVersionAction(kind, formData);
      dialogRef.current?.close();
      setFile(null);
      setPreviewHtml('');
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Caricamento non riuscito.');
    } finally {
      setIsUploading(false);
    }
  }

  function handleCancel() {
    dialogRef.current?.close();
    setFile(null);
    setPreviewHtml('');
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 text-brand-800 text-sm font-semibold px-3 py-1.5"
      >
        <Upload size={16} />
        Carica .docx
      </button>
      <input ref={fileInputRef} type="file" accept=".docx" onChange={handleFileChange} className="hidden" />

      <dialog
        ref={dialogRef}
        aria-labelledby="upload-doc-desc"
        className="m-auto rounded-lg p-0 backdrop:bg-stone-900/50 max-w-2xl w-[calc(100%-2rem)]"
      >
        <div className="p-5 space-y-4">
          <p id="upload-doc-desc" className="text-sm text-stone-700">
            Sostituire il contenuto pubblicato con quello del file{' '}
            <span className="font-semibold">{file?.name}</span>? Anteprima del contenuto convertito:
          </p>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-stone-200 p-4">
            {previewHtml ? (
              <div
                className="prose prose-stone prose-sm max-w-none"
                // Solo per anteprima: mammoth non produce mai <script>/markup arbitrario
                // (vedi DocumentView.tsx), stessa garanzia qui.
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <p className="text-sm text-stone-500 italic">Nessuna anteprima disponibile.</p>
            )}
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-stone-300 text-stone-700 text-sm font-semibold px-3 py-1.5"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isUploading || !file}
              aria-busy={isUploading}
              className="rounded-lg bg-brand-600 text-white text-sm font-semibold px-3 py-1.5 disabled:opacity-60 disabled:cursor-wait"
            >
              {isUploading ? 'Carico…' : 'Conferma sostituzione'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
