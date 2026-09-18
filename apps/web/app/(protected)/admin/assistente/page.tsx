// apps/web/app/(protected)/admin/assistente/page.tsx
//
// Pagina admin per monitorare e testare l'assistente IA.
// Solo admin (gate nel layout padre admin/).
import type { Metadata } from 'next';
import { AdminNav } from '../../../../components/admin/AdminNav';
import { AssistentePingButton } from '../../../../components/admin/AssistentePingButton';
import { AssistenteModelliConfig } from '../../../../components/admin/AssistenteModelliConfig';

export const metadata: Metadata = { title: 'Admin · Assistente IA' };

export default function AdminAssistentePage() {
  return (
    <main className="p-4 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="font-serif font-bold text-lg text-brand-950">Assistente IA</h1>
        <p className="text-xs text-stone-500 mt-0.5">
          Gestione dinamica dei modelli Gemini, ordine di preferenza globale e diagnostica di connessione.
        </p>
      </div>

      <AdminNav />

      {/* Sezione 1: Configurazione Modelli e Ordine Preferenze */}
      <div className="bg-white rounded-lg border border-stone-200 p-5 shadow-sm">
        <AssistenteModelliConfig />
      </div>

      {/* Sezione 2: Diagnostica e Test Live */}
      <div className="bg-white rounded-lg border border-stone-200 p-5 shadow-sm space-y-3">
        <div className="space-y-1">
          <h2 className="font-semibold text-stone-900 text-sm">Diagnostica e Test in tempo reale</h2>
          <p className="text-xs text-stone-500">
            Invia una query di test per verificare che il modello di testa (o i fallback se la quota è esaurita) risponda correttamente con la tua chiave Google.
            Non viene registrato nessun log in <code className="rounded bg-stone-100 px-1 py-0.5 font-mono">query_assistant_logs</code>.
          </p>
        </div>

        <AssistentePingButton />
      </div>
    </main>
  );
}
