'use client';

import { useState } from 'react';
import { Search, Loader2, AlertCircle, ServerCrash } from 'lucide-react';

type TipoErrore =
  | 'fuori_tema'
  | 'identita_mancante'
  | 'non_generabile'
  | 'errore_servizio_ia'
  | 'errore_temporaneo';

interface Risultato {
  risposta: string;
  sql?: string;
  righe?: unknown;
  tipoErrore?: TipoErrore;
}

/** Restituisce stili e icona in base alla natura dell'errore. */
function useErroreVisivo(tipoErrore: TipoErrore | undefined) {
  // errore_servizio_ia = problema infrastrutturale, non della domanda → tono
  // giallo/warning (non rosso/critico) e icona ServerCrash per distinguerlo
  // visivamente da errori della domanda (rosso).
  if (tipoErrore === 'errore_servizio_ia') {
    return {
      bordo: 'border-amber-200 bg-amber-50',
      testo: 'text-amber-800',
      Icona: ServerCrash,
      iconaClasse: 'text-amber-500 shrink-0',
    };
  }
  if (tipoErrore) {
    return {
      bordo: 'border-red-200 bg-red-50',
      testo: 'text-red-800',
      Icona: AlertCircle,
      iconaClasse: 'text-red-400 shrink-0',
    };
  }
  return null;
}

export function ChiediAllArchivio({
  placeholder = 'Chiedi qualcosa alla lega…',
}: {
  placeholder?: string;
}) {
  const [domanda, setDomanda] = useState('');
  const [caricamento, setCaricamento] = useState(false);
  const [risultato, setRisultato] = useState<Risultato | null>(null);
  const [mostraSql, setMostraSql] = useState(false);

  async function invia() {
    if (!domanda.trim() || caricamento) return;
    setCaricamento(true);
    setRisultato(null);
    setMostraSql(false);
    try {
      const res = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domanda }),
      });
      const data = await res.json();
      setRisultato(
        res.ok
          ? data
          : {
              risposta: data.error ?? 'Errore imprevisto.',
              tipoErrore: 'errore_temporaneo',
            }
      );
    } catch {
      setRisultato({ risposta: 'Errore di rete, riprova.', tipoErrore: 'errore_temporaneo' });
    } finally {
      setCaricamento(false);
    }
  }

  const erroreVisivo = useErroreVisivo(risultato?.tipoErrore);

  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
        Chiedi all&apos;Archivio
      </p>
      <h2 className="mt-1 font-serif text-lg font-bold text-brand-950">
        Una domanda, tutte le stagioni
      </h2>

      <div className="mt-3 flex gap-2">
        <input
          value={domanda}
          onChange={(e) => setDomanda(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && invia()}
          placeholder={placeholder}
          disabled={caricamento}
          className="flex-1 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-brand-950 placeholder:text-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          onClick={invia}
          disabled={caricamento || !domanda.trim()}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-400 px-3 py-2 text-sm font-semibold text-brand-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {caricamento ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {caricamento ? 'Sto cercando…' : 'Chiedi'}
        </button>
      </div>

      {risultato && (
        <div
          className={`mt-4 rounded-lg border p-3 ${
            erroreVisivo ? erroreVisivo.bordo : 'border-brand-200 bg-white'
          }`}
        >
          {erroreVisivo ? (
            <div className="flex items-start gap-2">
              <erroreVisivo.Icona className={`mt-0.5 h-4 w-4 ${erroreVisivo.iconaClasse}`} />
              <p className={`text-sm ${erroreVisivo.testo}`}>{risultato.risposta}</p>
            </div>
          ) : (
            <p className="text-sm text-stone-700">{risultato.risposta}</p>
          )}
          {risultato.sql && (
            <div className="mt-2">
              <button
                onClick={() => setMostraSql((v) => !v)}
                className="text-xs font-semibold text-brand-500 hover:text-brand-700"
              >
                {mostraSql ? 'Nascondi query generata' : 'Mostra query generata'}
              </button>
              {mostraSql && (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-100 p-2 text-xs text-stone-600">
                  {risultato.sql}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
