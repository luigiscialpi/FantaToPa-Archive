'use client';

import { ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Soglia in px, ma limitata a una frazione dello scroll disponibile: pagine
// come la classifica su mobile hanno poco scroll totale (~150-300px), quindi
// una soglia fissa pensata per pagine lunghe (es. un'intera altezza di
// viewport, provata inizialmente) non veniva mai superata e il pulsante non
// compariva mai su quelle pagine.
const MAX_THRESHOLD_PX = 200;
const MAX_SCROLL_FRACTION = 0.4;

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const thresholdRef = useRef(0);

  useEffect(() => {
    function recomputeThreshold() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      thresholdRef.current = Math.min(MAX_THRESHOLD_PX, maxScroll * MAX_SCROLL_FRACTION);
    }

    // ponytail: `scrollHeight` dipende dal layout, quindi leggerlo dentro
    // l'handler di 'scroll' (che su un flick veloce spara a frequenza
    // nativa) forzava un reflow sincrono ad ogni evento — su mobile
    // abbastanza pesante da far "perdere" al browser il touch di uno
    // scorrimento successivo. La soglia ora si ricalcola solo al mount/
    // resize; l'handler di scroll fa solo un confronto numerico, throttlato
    // in un frame con rAF.
    let scheduled = false;
    function handleScroll() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        setVisible(window.scrollY > thresholdRef.current);
        scheduled = false;
      });
    }

    recomputeThreshold();
    setVisible(window.scrollY > thresholdRef.current);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', recomputeThreshold);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', recomputeThreshold);
    };
  }, []);

  if (!visible) return null;

  function scrollToTop() {
    // rispetta la preferenza di sistema "riduci movimento" (WCAG 2.3.3)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Torna su"
      title="Torna su"
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 flex h-11 w-11 items-center justify-center rounded-full bg-brand-800 text-white shadow-lg transition hover:bg-brand-700 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
