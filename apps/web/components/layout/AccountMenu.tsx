// apps/web/components/layout/AccountMenu.tsx
//
// Dropdown account desktop: mostra il nome utente con pallino di stato ed
// espande il menu con le azioni account (Admin / Esci).
// Chiusura automatica al tap/click fuori, al cambio di rotta (pathname),
// alla pressione di Escape o al click su un'azione interna.
'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { SessionProfile } from '../../lib/auth/session';
import { AccountActions } from './AccountActions';

export function AccountMenu({ profile }: { profile: SessionProfile }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Membro';

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Account"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-brand-100 hover:text-white hover:bg-brand-600/60 px-2.5 py-1.5 rounded-md transition-colors"
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        <span className="max-w-[10rem] truncate">{displayName}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-white text-brand-950 shadow-xl border border-stone-200 py-1.5 z-30">
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
