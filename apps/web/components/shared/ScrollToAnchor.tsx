// apps/web/components/shared/ScrollToAnchor.tsx
//
// Next.js App Router non scorre automaticamente agli anchor hash su
// navigazione client-side perché il contenuto server-rendered non è ancora
// nel DOM quando il router processa l'URL. Questo componente legge
// window.location.hash al mount e scorre all'elemento corrispondente.
// Va montato una volta sola nel layout o nella pagina che contiene gli
// anchor target.
'use client';

import { useEffect } from 'react';

export function ScrollToAnchor() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const id = hash.slice(1); // rimuove il '#'
    // requestAnimationFrame lascia al browser il tempo di completare il
    // paint del DOM server-rendered prima di cercare l'elemento.
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  return null;
}
