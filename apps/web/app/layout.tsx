import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// Archivio riservato (AGENTS.md): niente pagine pre-renderizzate in build,
// altrimenti aggirerebbero la RLS. Impostato qui, nel layout radice, così
// vale per l'intera app senza doverlo ripetere in ogni page.tsx.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Archivio Storico FantaTopa',
  description: 'Archivio storico della lega FantaTopa',
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
