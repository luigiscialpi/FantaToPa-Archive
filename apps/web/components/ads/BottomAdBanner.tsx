// apps/web/components/ads/BottomAdBanner.tsx
//
// Banner fisso in basso. La richiesta originale era "cambia ogni minuto", ma
// un refresh a timer sullo stesso annuncio viola le policy AdSense (un
// annuncio va aggiornato solo a fronte di una vera navigazione/azione
// dell'utente, mai su un intervallo fisso). Qui la key={pathname} forza il
// remount di <AdSlot> — quindi un nuovo annuncio — solo quando l'utente
// cambia davvero pagina: conforme, e comunque frequente durante la
// navigazione normale del sito.
'use client';

import { usePathname } from 'next/navigation';
import { AdSlot } from './AdSlot';
import { ADSENSE_SLOT_BANNER } from '../../lib/ads/config';

export function BottomAdBanner() {
  const pathname = usePathname();

  if (!ADSENSE_SLOT_BANNER) return null;

  return (
    // min-h-[50px]: senza un'altezza riservata, un annuncio non ancora
    // riempito (in fase di revisione AdSense, o bloccato da un adblocker)
    // collassa a un filo invisibile — la barra resta comunque presente e
    // percepibile come sticky. pb-[env(safe-area-inset-bottom)]: sugli
    // iPhone col notch, altrimenti l'area del gesto home la sovrappone.
    <div className="fixed bottom-0 inset-x-0 z-30 min-h-[50px] bg-stone-100 border-t border-stone-300 flex justify-center items-center py-1 px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
      <AdSlot key={pathname} slot={ADSENSE_SLOT_BANNER} className="max-w-full" />
    </div>
  );
}
