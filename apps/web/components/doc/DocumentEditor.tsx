// apps/web/components/doc/DocumentEditor.tsx
//
// Editing diretto "dell'ultimo minuto" (richiesta esplicita: "non troppe
// cose") — StarterKit configurato per disabilitare blockquote/codeBlock/
// horizontalRule/strike/code/link/underline: restano solo grassetto,
// corsivo, header (2-3, l'h1 resta il titolo pagina) e liste. Salvataggio
// esplicito (nessun autosave): stessa UX delle altre edit mode admin
// (Formazioni/Classifica/Calendario/Rose), un pulsante "Salva" per
// azione via server action.
'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered } from 'lucide-react';
import { updateDocumentContentAction } from '../../lib/admin/document-actions';
import type { DocumentKind } from '../../lib/queries/documents';

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`rounded-md p-1.5 ${active ? 'bg-brand-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100'}`}
    >
      {children}
    </button>
  );
}

export function DocumentEditor({ kind, initialHtml }: { kind: DocumentKind; initialHtml: string }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: false,
        code: false,
        heading: { levels: [2, 3] },
      }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: 'prose prose-stone max-w-none prose-headings:font-serif prose-headings:text-brand-950 min-h-[12rem] focus:outline-none',
      },
    },
  });

  async function handleSave() {
    if (!editor) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateDocumentContentAction(kind, editor.getHTML());
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Salvataggio non riuscito.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!editor) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1.5">
        <ToolbarButton label="Grassetto" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton label="Corsivo" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Titolo"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Sottotitolo"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Elenco puntato"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Elenco numerato"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={16} />
        </ToolbarButton>
      </div>

      <div className="rounded-lg border border-stone-200 p-4">
        <EditorContent editor={editor} />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        aria-busy={isSaving}
        className="rounded-lg bg-brand-600 text-white text-sm font-semibold px-4 py-2 disabled:opacity-60 disabled:cursor-wait"
      >
        {isSaving ? 'Salvo…' : 'Salva modifiche'}
      </button>
    </div>
  );
}
