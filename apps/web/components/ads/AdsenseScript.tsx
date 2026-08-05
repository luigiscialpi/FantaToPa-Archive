// apps/web/components/ads/AdsenseScript.tsx
//
// Carica lo script adsbygoogle.js una sola volta per l'intera app (root
// layout). Server Component: legge solo l'env var pubblica, nessun hook.
// strategy="beforeInteractive": è l'unica che Next.js inietta sempre in
// <head> del documento iniziale (per qualunque altra strategy la posizione
// nel JSX non è garantita) — AdSense chiede esplicitamente questo script in
// <head>, serve anche per la verifica del sito lato Google.
import Script from 'next/script';
import { ADSENSE_CLIENT_ID } from '../../lib/ads/config';

export function AdsenseScript() {
  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
      strategy="beforeInteractive"
    />
  );
}
