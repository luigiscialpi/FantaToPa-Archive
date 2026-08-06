// apps/web/components/layout/MobileMenu.tsx
//
// Hamburger mobile: era un <details> senza JS/stato, sostituito da un
// componente client perché servono due comportamenti che <details> non offre
// nativamente — chiusura al tap fuori dal menu, e un sottomenu stagione che
// si apre/chiude indipendentemente e richiude tutto il menu alla scelta
// (SeasonSwitcher.onSelect). "Admin" richiude il menu al click (onAdminClick
// su AccountActions); "Esci" no, di proposito — il form di sign-out
// reindirizza l'intera pagina, richiudere il menu prima non serve a nulla di
// percepibile per l'utente.
'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { SessionProfile } from '../../lib/auth/session';
import type { SeasonOption } from '../../lib/queries/seasons';
import { AccountActions } from './AccountActions';
import { SeasonSwitcher } from './SeasonSwitcher';

export function MobileMenu({ profile, seasons }: { profile: SessionProfile; seasons: SeasonOption[] }) {
  const [open, setOpen] = useState(false);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Membro';

  // A differenza del selettore inline (nascosto su tutte le route
  // top-level), il sottomenu qui resta utile anche su Albo d'Oro/
  // Statistiche/Profilo Squadra per saltare a una stagione — solo Home ne
  // è esclusa, perché mostra già un selettore stagione in pagina.
  const showSeasonSubmenu = pathname !== '/' && seasons.filter((season) => season.hasSchedule).length > 1;

  useEffect(() => {
    if (!open) {
      setSeasonMenuOpen(false);
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative sm:hidden shrink-0">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="p-1.5 -ml-1.5 rounded-md hover:bg-brand-600/60 transition-colors"
      >
        <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-56 rounded-lg bg-white text-brand-950 shadow-xl border border-stone-200 py-1.5 z-30">
          <div className="px-3 py-1.5 mb-1 border-b border-stone-100 text-xs text-stone-500 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="truncate">{displayName}</span>
          </div>

          {showSeasonSubmenu && (
            <div className="border-b border-stone-100 mb-1 pb-1">
              <button
                type="button"
                aria-expanded={seasonMenuOpen}
                onClick={() => setSeasonMenuOpen((value) => !value)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-brand-900 hover:bg-stone-100 transition-colors"
              >
                Stagione
                <svg
                  className={`w-3.5 h-3.5 fill-current transition-transform ${seasonMenuOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </button>
              {seasonMenuOpen && (
                <div className="px-3 pt-1">
                  <SeasonSwitcher seasons={seasons} onSelect={() => setOpen(false)} alwaysVisible />
                </div>
              )}
            </div>
          )}

          <AccountActions
            profile={profile}
            itemClassName="block w-full text-left px-3 py-2 text-sm font-medium text-brand-900 hover:bg-stone-100 transition-colors"
            onAdminClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
