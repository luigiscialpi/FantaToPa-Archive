'use client';

import { useState } from 'react';
import { Activity, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface RispostaPing {
  ok: boolean;
  modello: string;
  latenzaMs: number;
  inScope?: boolean;
  sqlGenerata?: string | null;
  errore?: string;
}

type Stato = 'idle' | 'loading' | 'ok' | 'ko';

export function AssistentePingButton() {
  const [stato, setStato] = useState<Stato>('idle');
  const [dati, setDati] = useState<RispostaPing | null>(null);

  async function eseguiPing() {
    setStato('loading');
    setDati(null);
    try {
      const res = await fetch('/api/assistente/ping');
      const json = (await res.json()) as RispostaPing;
      setDati(json);
      setStato(json.ok ? 'ok' : 'ko');
    } catch {
      setDati(null);
      setStato('ko');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={eseguiPing}
          disabled={stato === 'loading'}
          className="flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-brand-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {stato === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Activity className="h-4 w-4" />
          )}
          {stato === 'loading' ? 'Sto testando…' : 'Testa assistente IA'}
        </button>

        {stato === 'ok' && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Online
          </span>
        )}
        {stato === 'ko' && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
            <XCircle className="h-4 w-4" />
            Non disponibile
          </span>
        )}
      </div>

      {dati && (
        <div
          className={`rounded-lg border p-3 text-sm space-y-1 ${
            dati.ok
              ? 'border-green-200 bg-green-50 text-green-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <p>
            <span className="font-medium">Modello:</span> {dati.modello}
          </p>
          <p>
            <span className="font-medium">Latenza:</span> {dati.latenzaMs} ms
          </p>
          {dati.ok && (
            <>
              <p>
                <span className="font-medium">In-scope:</span>{' '}
                {dati.inScope ? 'sì' : 'no (anomalo)'}
              </p>
              {dati.sqlGenerata && (
                <details className="pt-1">
                  <summary className="cursor-pointer text-xs font-semibold opacity-70 hover:opacity-100">
                    SQL generata
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-white/60 p-2 text-xs">
                    {dati.sqlGenerata}
                  </pre>
                </details>
              )}
            </>
          )}
          {dati.errore && (
            <details className="pt-1">
              <summary className="cursor-pointer text-xs font-semibold opacity-70 hover:opacity-100">
                Dettaglio errore
              </summary>
              <pre className="mt-1 overflow-x-auto rounded bg-white/60 p-2 text-xs whitespace-pre-wrap break-all">
                {dati.errore}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
