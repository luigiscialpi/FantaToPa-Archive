// apps/web/components/ads/AdSlot.tsx
//
// Wrapper riusabile attorno a <ins class="adsbygoogle">: il push su
// window.adsbygoogle va fatto una sola volta per elemento montato, dopo che
// adsbygoogle.js (caricato da AdsenseScript) è stato eseguito. Se l'utente
// ha un adblocker o lo script non è ancora pronto, il push fallisce e basta
// — nessun messaggio d'errore da mostrare per un annuncio non caricato.
'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT_ID } from '../../lib/ads/config';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot({ slot, className }: { slot: string; className?: string }) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // adsbygoogle.js non caricato/bloccato: nessuno spazio vuoto da gestire,
      // l'elemento <ins> resta semplicemente senza contenuto.
    }
  }, []);

  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <ins
      className={`adsbygoogle block ${className ?? ''}`}
      style={{ display: 'block' }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
