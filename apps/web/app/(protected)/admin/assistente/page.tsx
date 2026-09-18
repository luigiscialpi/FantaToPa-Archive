// apps/web/app/(protected)/admin/assistente/page.tsx
//
// Pagina admin per monitorare e testare l'assistente IA.
// Solo admin (gate nel layout padre admin/).
import type { Metadata } from 'next';
import { AdminNav } from '../../../../components/admin/AdminNav';
import { AssistentePingButton } from '../../../../components/admin/AssistentePingButton';
import { aiAssistenteEnv } from '../../../../lib/ai-assistente/env';

export const metadata: Metadata = { title: 'Admin · Assistente IA' };

export default function AdminAssistentePage() {
  const modello = aiAssistenteEnv.GEMINI_MODEL;

  return (
    <main className="p-4 space-y-4 max-w-3xl mx-auto">
      <h1 className="font-serif font-bold text-lg text-brand-950">Assistente IA</h1>
      <AdminNav />

      <div className="bg-white rounded-lg border border-stone-200 p-4 space-y-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-stone-800 text-sm">Stato del servizio</h2>
          <p className="text-xs text-stone-500">
            Modello configurato:{' '}
            <code className="rounded bg-stone-100 px-1 py-0.5 font-mono">{modello}</code>
            {' · '}variabile d&apos;ambiente <code className="rounded bg-stone-100 px-1 py-0.5 font-mono">GEMINI_MODEL</code>
          </p>
          <p className="text-xs text-stone-400">
            Il test invia una domanda fissa e verifica che Gemini risponda correttamente.
            Non viene salvato nessun log in <code className="rounded bg-stone-100 px-1 py-0.5 font-mono">query_assistant_logs</code>.
          </p>
        </div>

        <AssistentePingButton />
      </div>
    </main>
  );
}
