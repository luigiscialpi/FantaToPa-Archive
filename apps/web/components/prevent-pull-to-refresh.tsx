'use client';

import { useEffect } from 'react';

/**
 * Disabilita il pull-to-refresh di iOS Safari.
 *
 * `overscroll-behavior-y` basta su Android Chrome, ma Safari iOS applica il
 * refresh a livello di viewport: bisogna intercettare il gesto verso il basso
 * quando la pagina è già in cima e chiamare `preventDefault()`.
 */
export function PreventPullToRefresh() {
  useEffect(() => {
    let startY = 0;
    let startX = 0;

    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length === 1) {
        startY = event.touches[0].clientY;
        startX = event.touches[0].clientX;
      }
    }

    function handleTouchMove(event: TouchEvent) {
      if (event.touches.length !== 1) return;

      const y = event.touches[0].clientY;
      const x = event.touches[0].clientX;
      const deltaY = y - startY;
      const deltaX = x - startX;

      // Blocca solo se il gesto è principalmente verso il basso e siamo in
      // cima alla pagina; in tutti gli altri casi lo scroll nativo rimane.
      if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 0 && window.scrollY <= 0) {
        event.preventDefault();
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return null;
}
