import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { siteOrigin } from '../lib/auth/actions';
import './globals.css';

// Archivio riservato (AGENTS.md): niente pagine pre-renderizzate in build,
// altrimenti aggirerebbero la RLS. Impostato qui, nel layout radice, così
// vale per l'intera app senza doverlo ripetere in ogni page.tsx.
export const dynamic = 'force-dynamic';

const DESCRIPTION = 'Classifiche, calendari, rose e statistiche di tutte le stagioni della lega FantaTopa.';

export async function generateMetadata(): Promise<Metadata> {
  return {
    // Serve solo a rendere assolute le immagini OpenGraph. Derivata dalla
    // richiesta invece che hardcodata, come siteOrigin() fa già per gli
    // emailRedirectTo: identico in locale e in produzione, niente da
    // tenere sincronizzato a mano.
    metadataBase: new URL(await siteOrigin()),
    title: { default: 'Archivio Storico FantaTopa', template: '%s · FantaTopa' },
    description: DESCRIPTION,
    applicationName: 'FantaTopa',
    // Nessun `Disallow` in app/robots.ts di proposito: un crawler bloccato lì
    // non arriva mai a leggere questo `noindex`, e un URL condiviso in chiaro
    // finirebbe comunque in SERP come link nudo.
    robots: { index: false, follow: false },
    // Anteprima quando il link viene incollato in chat. Ereditata da tutte le
    // pagine: il contenuto è riservato, quindi l'anteprima resta volutamente
    // generica e uguale ovunque, senza dati di lega.
    openGraph: {
      type: 'website',
      locale: 'it_IT',
      siteName: 'Archivio Storico FantaTopa',
      title: 'Archivio Storico FantaTopa',
      description: DESCRIPTION,
      images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'FantaTopa' }],
    },
    // iOS ignora il manifest per il nome e l'icona in home screen: legge questi
    // meta/link, quindi vanno tenuti allineati a app/manifest.ts a mano.
    appleWebApp: { capable: true, title: 'FantaTopa', statusBarStyle: 'default' },
    icons: {
      icon: [
        { url: '/icons/app-icon.svg', type: 'image/svg+xml' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: { url: '/icons/apple-icon-180.png', sizes: '180x180' },
    },
    // Next emette solo `mobile-web-app-capable`, che Safari legge da iOS 17.4:
    // senza il meta legacy, su iPhone più vecchi l'app in home screen si
    // aprirebbe dentro Safari invece che a tutto schermo.
    other: { 'apple-mobile-web-app-capable': 'yes' },
  };
}

export const viewport: Viewport = {
  themeColor: '#2556b8',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // scrollbar-gutter va su html, non su body: è html (il root element) a
    // generare la scrollbar del viewport, su body la proprietà non ha
    // effetto — senza, il contenitore centrato "saltava" di ~7px tra
    // pagine con e senza scroll verticale.
    <html lang="it" className="[scrollbar-gutter:stable]">
      <body className="bg-stone-100 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
