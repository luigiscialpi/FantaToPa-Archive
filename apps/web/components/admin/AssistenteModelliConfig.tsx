// apps/web/components/admin/AssistenteModelliConfig.tsx
//
// Componente per configurare l'ordine di preferenza e la catena di fallback
// dei modelli Gemini per tutti gli utenti della lega.
'use client';

import { useState, useEffect } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
} from 'lucide-react';

interface ModelloScoperto {
  id: string;
  displayName: string;
  description: string;
  raccomandato: boolean;
}

export function AssistenteModelliConfig() {
  const [catena, setCatena] = useState<string[]>([]);
  const [catenaOriginale, setCatenaOriginale] = useState<string[]>([]);
  const [modelliDisponibili, setModelliDisponibili] = useState<ModelloScoperto[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [messaggioSuccesso, setMessaggioSuccesso] = useState<string | null>(null);

  async function caricaDati() {
    setCaricamento(true);
    setErrore(null);
    try {
      const res = await fetch('/api/admin/assistente/modelli');
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.errore || data.error || 'Errore nel caricamento dei modelli');
      }
      setCatena(data.catenaAttiva);
      setCatenaOriginale(data.catenaAttiva);
      setModelliDisponibili(data.modelliDisponibili || []);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
    } finally {
      setCaricamento(false);
    }
  }

  useEffect(() => {
    caricaDati();
  }, []);

  function sposta(index: number, direzione: 'su' | 'giu') {
    const nuova = [...catena];
    const targetIndex = direzione === 'su' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= nuova.length) return;
    const temp = nuova[index]!;
    nuova[index] = nuova[targetIndex]!;
    nuova[targetIndex] = temp;
    setCatena(nuova);
    setMessaggioSuccesso(null);
  }

  function rimuovi(index: number) {
    if (catena.length <= 1) {
      alert('La catena deve contenere almeno un modello attivo.');
      return;
    }
    setCatena(catena.filter((_, i) => i !== index));
    setMessaggioSuccesso(null);
  }

  function aggiungi(modelId: string) {
    if (catena.includes(modelId)) return;
    setCatena([...catena, modelId]);
    setMessaggioSuccesso(null);
  }

  async function salva() {
    if (catena.length === 0) return;
    setSalvataggio(true);
    setErrore(null);
    setMessaggioSuccesso(null);
    try {
      const res = await fetch('/api/admin/assistente/modelli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: catena }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Errore durante il salvataggio');
      }
      setCatenaOriginale([...catena]);
      setMessaggioSuccesso('Configurazione salvata con successo per tutti gli utenti!');
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvataggio(false);
    }
  }

  const modificato = JSON.stringify(catena) !== JSON.stringify(catenaOriginale);
  const modelliEsclusi = modelliDisponibili.filter((m) => !catena.includes(m.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <div>
          <h3 className="text-base font-semibold text-stone-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-brand-600" />
            Catena modelli e ordine di preferenza
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Il primo modello è usato come predefinito. Se la quota del primo si esaurisce (429) o
            non risponde, il sistema passa automaticamente a quelli successivi.
          </p>
        </div>
        <button
          onClick={caricaDati}
          disabled={caricamento}
          className="flex items-center gap-1.5 self-start text-xs font-medium text-stone-600 hover:text-stone-900 px-2.5 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${caricamento ? 'animate-spin' : ''}`} />
          Rileva da Google
        </button>
      </div>

      {errore && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errore}</span>
        </div>
      )}

      {messaggioSuccesso && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
          <span>{messaggioSuccesso}</span>
        </div>
      )}

      {/* Lista Catena Attiva */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Catena attiva (in ordine di interrogazione)
        </p>
        <div className="space-y-2">
          {catena.map((modelId, index) => {
            const scoperto = modelliDisponibili.find((m) => m.id === modelId);
            const isPrimo = index === 0;
            const isUltimo = index === catena.length - 1;

            return (
              <div
                key={modelId}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-all ${
                  isPrimo
                    ? 'border-brand-300 bg-brand-50/70 shadow-sm'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isPrimo
                        ? 'bg-brand-500 text-white'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-stone-900 truncate">
                        {modelId}
                      </span>
                      {isPrimo && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Default per tutti
                        </span>
                      )}
                      {!isPrimo && (
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                          Fallback #{index}
                        </span>
                      )}
                      {scoperto?.raccomandato && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          <Sparkles className="h-3 w-3" />
                          Consigliato Free
                        </span>
                      )}
                    </div>
                    {scoperto?.description && (
                      <p className="text-xs text-stone-500 truncate max-w-md mt-0.5">
                        {scoperto.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => sposta(index, 'su')}
                    disabled={isPrimo}
                    title="Sposta prima (aumenta priorità)"
                    className="p-1.5 text-stone-500 hover:text-stone-900 rounded hover:bg-stone-100 disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => sposta(index, 'giu')}
                    disabled={isUltimo}
                    title="Sposta dopo (riduci priorità)"
                    className="p-1.5 text-stone-500 hover:text-stone-900 rounded hover:bg-stone-100 disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => rimuovi(index)}
                    disabled={catena.length <= 1}
                    title="Rimuovi dalla catena"
                    className="p-1.5 text-stone-400 hover:text-red-600 rounded hover:bg-red-50 disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pulsante Salva */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-stone-500">
          {modificato ? 'Ci sono modifiche non salvate.' : 'Configurazione sincronizzata con il database.'}
        </p>
        <button
          onClick={salva}
          disabled={salvataggio || !modificato}
          className="flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          {salvataggio ? 'Salvataggio…' : 'Salva configurazione'}
        </button>
      </div>

      {/* Altri modelli disponibili rilevati */}
      {modelliEsclusi.length > 0 && (
        <div className="border-t border-stone-200 pt-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Altri modelli disponibili sulla tua chiave API Google
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {modelliEsclusi.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-dashed border-stone-200 bg-stone-50/50 hover:bg-stone-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-stone-800 truncate">
                      {m.id}
                    </span>
                    {m.raccomandato && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-medium text-amber-800">
                        Consigliato
                      </span>
                    )}
                  </div>
                  {m.displayName && (
                    <p className="text-[11px] text-stone-400 truncate">{m.displayName}</p>
                  )}
                </div>
                <button
                  onClick={() => aggiungi(m.id)}
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 px-2 py-1 rounded border border-brand-200 hover:bg-brand-50 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Aggiungi
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
