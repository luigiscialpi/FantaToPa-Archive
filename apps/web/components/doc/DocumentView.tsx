// apps/web/components/doc/DocumentView.tsx
//
// Resa di sola lettura del contenuto del documento. dangerouslySetInnerHTML
// è sicuro qui perché l'HTML non arriva mai da input utente non filtrato:
// o è l'output di mammoth (converte un .docx, che non può contenere
// <script>/markup arbitrario) o è il risultato di editor.getHTML() di
// Tiptap, serializzato dallo schema ProseMirror configurato in
// DocumentEditor — solo i tag lì esplicitamente abilitati (p/strong/em/h2/
// h3/ul/ol/li/br) possono comparire, mai markup arbitrario iniettato
// dall'admin. ponytail: nessun sanitizer aggiuntivo finché queste due sono
// le uniche fonti di scrittura — se in futuro si aggiunge un'altra fonte
// (es. import di terze parti), va rivalutato.
export function DocumentView({ html }: { html: string }) {
  if (!html.trim()) {
    return <p className="text-sm text-stone-500 italic">Nessun contenuto ancora pubblicato.</p>;
  }

  return (
    <div
      className="prose prose-stone max-w-none prose-headings:font-serif prose-headings:text-brand-950"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
