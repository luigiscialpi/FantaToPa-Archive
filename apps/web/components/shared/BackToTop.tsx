'use client';

import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';

// Soglia in px, ma limitata a una frazione dello scroll disponibile: pagine
// come la classifica su mobile hanno poco scroll totale (~150-300px), quindi
// una soglia fissa pensata per pagine lunghe (es. un'intera altezza di
// viewport, provata inizialmente) non veniva mai superata e il pulsante non
// compariva mai su quelle pagine.
const MAX_THRESHOLD_PX = 200;
const MAX_SCROLL_FRACTION = 0.4;

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const threshold = Math.min(MAX_THRESHOLD_PX, maxScroll * MAX_SCROLL_FRACTION);
      setVisible(window.scrollY > threshold);
    }
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
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
