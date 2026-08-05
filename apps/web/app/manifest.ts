import type { MetadataRoute } from 'next';

// Rende il sito installabile (PWA) su Android e iOS. Nessun service worker:
// i criteri di installabilità di Chrome non lo richiedono più, e un SW che
// mette in cache pagine di un archivio riservato le lascerebbe leggibili a
// chi usa lo stesso dispositivo dopo il logout.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Archivio Storico FantaTopa',
    short_name: 'FantaTopa',
    description: 'Archivio storico della lega FantaTopa',
    lang: 'it',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // brand-700 (header) e stone-100 (sfondo body): la splash screen di
    // Android usa questi due, non i colori calcolati dalla pagina.
    theme_color: '#2556b8',
    background_color: '#f5f5f4',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Stesso file anche come maskable: il gufo è già dentro la safe zone
      // dell'80%, quindi il ritaglio di Android non lo tocca.
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
