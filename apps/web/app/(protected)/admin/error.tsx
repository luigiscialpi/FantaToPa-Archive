// apps/web/app/(protected)/admin/error.tsx
//
// Rete di sicurezza per le azioni admin (Stagioni/Utenti/Registrazioni):
// senza un error boundary, un errore atteso (es. validazione mancata in una
// server action) mostrava la pagina di crash di default di Next.js invece
// di un messaggio recuperabile.
'use client';

import { useEffect } from 'react';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="p-4 max-w-lg mx-auto">
      <div className="bg-white rounded-lg border border-red-200 p-4 space-y-3">
        <h1 className="font-serif font-bold text-lg text-brand-950">Qualcosa è andato storto</h1>
        <p className="text-sm text-stone-600">{error.message || 'Errore imprevisto.'}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5"
        >
          Riprova
        </button>
      </div>
    </main>
  );
}
