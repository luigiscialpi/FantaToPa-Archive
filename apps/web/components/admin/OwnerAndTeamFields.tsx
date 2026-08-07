// apps/web/components/admin/OwnerAndTeamFields.tsx
//
// Campi "Proprietario"/"Nome squadra" condivisi da Campionato e Coppa
// (aggiungi squadra alla classifica / aggiungi vincitore Coppa): client
// component solo per rendere i due percorsi (proprietario già noto vs
// nuovo) mutuamente esclusivi via disabled — un input disabilitato non
// viene incluso in FormData, quindi il server riceve sempre e solo i campi
// del percorso scelto, senza bisogno di validarlo lato client.
'use client';

import { useEffect, useRef, useState } from 'react';

export type KnownOwner = { teamId: string; ownerName: string; teamName: string };
export type AvailableTeam = { id: string; name: string };

export function OwnerAndTeamFields({
  knownOwners,
  availableTeams,
}: {
  knownOwners: KnownOwner[];
  availableTeams: AvailableTeam[];
}) {
  const [owner, setOwner] = useState('');
  const hasExistingOwner = owner !== '';
  const [validationError, setValidationError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Valida il ramo "nuovo proprietario" PRIMA che il form arrivi alla
  // server action: senza questo, un proprietario/squadra mancante fa
  // fallire l'azione con un errore non gestito (nessun error boundary in
  // questa pagina), che a schermo sembra "la pagina è andata in errore" —
  // qui invece si blocca il submit e si mostra un messaggio comprensibile.
  useEffect(() => {
    const form = selectRef.current?.closest('form');
    if (!form) return undefined;

    function handleSubmit(event: SubmitEvent) {
      const data = new FormData(form as HTMLFormElement);
      const ownerValue = data.get('owner');
      if (typeof ownerValue === 'string' && ownerValue !== '') {
        setValidationError(null);
        return;
      }

      const newOwnerName = (data.get('newOwnerName') as string | null)?.trim();
      if (!newOwnerName) {
        event.preventDefault();
        setValidationError('Indica il nome del nuovo proprietario, oppure scegli un proprietario già esistente qui sopra.');
        return;
      }

      const teamId = data.get('teamId') as string | null;
      const newTeamName = (data.get('newTeamName') as string | null)?.trim();
      if (!teamId && !newTeamName) {
        event.preventDefault();
        setValidationError('Scegli una squadra già esistente oppure indicane una nuova.');
        return;
      }

      setValidationError(null);
    }

    form.addEventListener('submit', handleSubmit);
    return () => form.removeEventListener('submit', handleSubmit);
  }, []);

  return (
    <>
      <label className="col-span-2 sm:col-span-4 flex flex-col text-xs text-stone-500 gap-1">
        Proprietario esistente (se il proprietario è già stato censito in una stagione precedente)
        <select
          ref={selectRef}
          name="owner"
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
          className="rounded border border-stone-300 text-sm px-2 py-1.5"
        >
          <option value="">Nessuno di questi — è un nuovo proprietario, vedi sotto</option>
          {knownOwners.map((known) => (
            <option key={known.teamId} value={`${known.teamId}::${known.ownerName}`}>
              {known.ownerName} — {known.teamName}
            </option>
          ))}
        </select>
      </label>
      <label className="col-span-2 sm:col-span-4 flex flex-col text-xs text-stone-500 gap-1">
        Nome squadra per questa stagione, se il proprietario ha rinominato la squadra (opzionale, l&apos;identità
        della squadra resta la stessa)
        <input
          type="text"
          name="seasonDisplayName"
          placeholder="Nome squadra"
          disabled={!hasExistingOwner}
          className="rounded border border-stone-300 text-sm px-2 py-1.5 disabled:bg-stone-100 disabled:text-stone-400"
        />
      </label>
      <p className="col-span-2 sm:col-span-4 text-xs text-stone-400 border-t border-stone-100 pt-2">
        Se il proprietario non è nella lista sopra, indicalo qui (il nome squadra si sceglie/inserisce più sotto):
      </p>
      <label className="col-span-2 sm:col-span-4 flex flex-col text-xs text-stone-500 gap-1">
        Nome del nuovo proprietario
        <input
          type="text"
          name="newOwnerName"
          placeholder='Nome proprietario (es. "Mario Rossi", o "Mario Rossi e Luca Bianchi" per doppia gestione)'
          disabled={hasExistingOwner}
          className="rounded border border-stone-300 text-sm px-2 py-1.5 disabled:bg-stone-100 disabled:text-stone-400"
        />
      </label>
      {availableTeams.length > 0 && (
        <label className="col-span-2 sm:col-span-4 flex flex-col text-xs text-stone-500 gap-1">
          Squadra già esistente (senza proprietario ancora assegnato)
          <select
            name="teamId"
            disabled={hasExistingOwner}
            className="rounded border border-stone-300 text-sm px-2 py-1.5 disabled:bg-stone-100 disabled:text-stone-400"
          >
            <option value="">Seleziona…</option>
            {availableTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="col-span-2 sm:col-span-4 flex flex-col text-xs text-stone-500 gap-1">
        Oppure nome squadra nuovo (mai vista in nessuna stagione, es. un club che partecipò solo qui)
        <input
          type="text"
          name="newTeamName"
          placeholder="Nome squadra"
          disabled={hasExistingOwner}
          className="rounded border border-stone-300 text-sm px-2 py-1.5 disabled:bg-stone-100 disabled:text-stone-400"
        />
      </label>
      {validationError && (
        <p className="col-span-2 sm:col-span-4 text-xs text-red-600" role="alert">
          {validationError}
        </p>
      )}
    </>
  );
}
