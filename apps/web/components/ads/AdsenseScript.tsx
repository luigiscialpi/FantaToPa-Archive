// apps/web/components/ads/AdsenseScript.tsx
//
// Carica lo script adsbygoogle.js una sola volta per l'intera app (root
// layout, dentro <head>). Server Component: legge solo l'env var pubblica,
// nessun hook. Tag <script> nativo, non next/script: quest'ultimo, con
// qualunque strategy, emette nell'HTML statico solo un <link rel=preload> e
// inietta il vero <script> via JS a runtime — invisibile a un crawler che fa
// solo un parsing statico, come quello di verifica di AdSense (verificato:
// serviva il tag letterale in <head>, non un preload).
import { ADSENSE_CLIENT_ID } from '../../lib/ads/config';

export function AdsenseScript() {
  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
    />
  );
}
