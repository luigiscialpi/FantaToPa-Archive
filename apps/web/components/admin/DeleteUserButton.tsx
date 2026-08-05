// apps/web/components/admin/DeleteUserButton.tsx
//
// Eliminazione account è irreversibile (auth.users + profiles a cascata,
// vedi admin_delete_user): serve una conferma esplicita, non un click
// singolo. <dialog> nativo invece di una libreria modale — un solo utilizzo,
// nessun bisogno di gestione focus-trap avanzata oltre a quella già
// integrata nell'elemento nativo.
'use client';

import { useRef } from 'react';
import { deleteUserAction } from '../../lib/admin/user-actions';
import { SubmitButton } from '../shared/SubmitButton';

export function DeleteUserButton({ userId, userLabel }: { userId: string; userLabel: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-lg border border-red-300 text-red-700 text-sm font-semibold px-3 py-1.5"
      >
        Elimina
      </button>
      {/* m-auto: il reset margin:0 di Tailwind Preflight sovrascrive il margin:auto
          nativo con cui il browser centra un <dialog> aperto in showModal(). */}
      <dialog
        ref={dialogRef}
        aria-labelledby={`delete-user-${userId}-desc`}
        className="m-auto rounded-lg p-0 backdrop:bg-stone-900/50 max-w-sm w-[calc(100%-2rem)]"
      >
        <form action={deleteUserAction.bind(null, userId)} className="p-5 space-y-4">
          <p id={`delete-user-${userId}-desc`} className="text-sm text-stone-700">
            Eliminare definitivamente l&apos;account di <span className="font-semibold">{userLabel}</span>? L&apos;azione
            non è reversibile.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg border border-stone-300 text-stone-700 text-sm font-semibold px-3 py-1.5"
            >
              Annulla
            </button>
            <SubmitButton
              pendingLabel="Elimino…"
              className="rounded-lg bg-red-700 text-white text-sm font-semibold px-3 py-1.5 disabled:opacity-60 disabled:cursor-wait"
            >
              Conferma eliminazione
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
