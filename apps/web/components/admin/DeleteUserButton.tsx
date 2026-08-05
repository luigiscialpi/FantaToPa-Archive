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
      <dialog ref={dialogRef} className="rounded-lg p-0 backdrop:bg-stone-900/50 max-w-sm w-full">
        <form action={deleteUserAction.bind(null, userId)} className="p-5 space-y-4">
          <p className="text-sm text-stone-700">
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
            <button type="submit" className="rounded-lg bg-red-700 text-white text-sm font-semibold px-3 py-1.5">
              Conferma eliminazione
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
