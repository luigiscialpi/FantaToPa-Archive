// apps/web/components/shared/LinkPending.tsx
//
// Spinner che compare dentro un <Link> mentre la sua navigazione è in corso.
// useLinkStatus() legge lo stato del Link antenato più vicino, quindi deve
// vivere in un componente figlio: non si può derivare il pending dal Link
// stesso. Serve soprattutto per tab e pillole torneo, che navigano sulla
// stessa route cambiando solo i searchParams: lì il contenuto precedente
// resta a schermo identico finché il server non risponde, senza nessun
// segnale che il click sia stato registrato.
'use client';

import { useLinkStatus } from 'next/link';
import { LoaderCircle } from 'lucide-react';

export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();

  if (!pending) {
    return null;
  }

  return (
    <LoaderCircle
      size={12}
      role="status"
      aria-label="Caricamento in corso"
      className={`shrink-0 animate-spin ${className ?? ''}`}
    />
  );
}
