// apps/web/components/admin/DeleteSeasonButton.tsx
//
// Eliminazione stagione: cancella a cascata classifica/calendario/rose/
// formazioni collegati (deleteSeasonAction, season-actions.ts), irreversibile.
// Stesso pattern di conferma di DeleteUserButton (<dialog> nativo).
'use client';

import { useRef } from 'react';
import { deleteSeasonAction } from '../../lib/admin/season-actions';
import { SubmitButton } from '../shared/SubmitButton';

export function DeleteSeasonButton({ seasonId, seasonLabel }: { seasonId: string; seasonLabel: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="shrink-0 rounded-lg border border-red-300 text-red-700 text-sm font-semibold px-3 py-1.5"
      >
        Elimina
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`delete-season-${seasonId}-desc`}
        className="m-auto rounded-lg p-0 backdrop:bg-stone-900/50 max-w-sm w-[calc(100%-2rem)]"
      >
        <form action={deleteSeasonAction.bind(null, seasonId)} className="p-5 space-y-4">
          <p id={`delete-season-${seasonId}-desc`} className="text-sm text-stone-700">
            Eliminare definitivamente <span className="font-semibold">{seasonLabel}</span>? Classifica, calendario,
            rose e formazioni collegati vengono cancellati insieme alla stagione. L&apos;azione non è reversibile.
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
