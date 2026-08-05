// apps/web/components/ads/RewardedAdButton.tsx
//
// Non è un rewarded ad "vero" (AdMob/Ad Manager, con verifica server-side del
// completamento): AdSense su web non lo supporta fuori dal programma H5
// games. Qui è solo un annuncio display mostrato dietro un click esplicito
// ("guarda una pubblicità per supportarci"), con un piccolo timer che tiene
// aperto il dialog finché l'annuncio ha avuto il tempo di essere visto —
// nessun premio funzionale, solo un ringraziamento a schermo (scelta
// esplicita: niente da sbloccare).
'use client';

import { useEffect, useRef, useState } from 'react';
import { AdSlot } from './AdSlot';
import { ADSENSE_SLOT_REWARD } from '../../lib/ads/config';

const MIN_VIEW_SECONDS = 15;

export function RewardedAdButton({ itemClassName }: { itemClassName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(MIN_VIEW_SECONDS);
  const [done, setDone] = useState(false);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!ADSENSE_SLOT_REWARD) return null;

  function open() {
    setSecondsLeft(MIN_VIEW_SECONDS);
    setDone(false);
    dialogRef.current?.showModal();
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setDone(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function close() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    dialogRef.current?.close();
  }

  return (
    <>
      <button type="button" onClick={open} className={itemClassName}>
        Guarda una pubblicità 🙏
      </button>
      {/* m-auto: vedi DeleteUserButton, stesso motivo (Preflight azzera il
          margin:auto nativo di centratura di <dialog>). */}
      <dialog
        ref={dialogRef}
        aria-labelledby="rewarded-ad-desc"
        className="m-auto rounded-lg p-0 backdrop:bg-stone-900/50 max-w-sm w-[calc(100%-2rem)]"
        onClose={() => intervalRef.current && clearInterval(intervalRef.current)}
      >
        <div className="p-5 space-y-4 text-center">
          <p id="rewarded-ad-desc" className="text-sm text-stone-700">
            {done ? 'Grazie per il supporto! 💛' : 'Grazie per il supporto: aiuta a coprire i costi del sito.'}
          </p>
          <AdSlot slot={ADSENSE_SLOT_REWARD} className="min-h-[250px]" />
          <button
            type="button"
            onClick={close}
            disabled={!done}
            className="w-full rounded-lg bg-brand-700 text-white text-sm font-semibold px-3 py-1.5 disabled:opacity-60 disabled:cursor-wait"
          >
            {done ? 'Chiudi' : `Chiudi (${secondsLeft}s)`}
          </button>
        </div>
      </dialog>
    </>
  );
}
