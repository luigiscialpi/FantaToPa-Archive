// apps/web/components/calendario/MatchdayJumpBar.tsx
//
// Stesso pattern di RosterJumpBar (rose): il Calendario mostra già tutte le
// giornate una sotto l'altra in una sola pagina, quindi "selettore
// giornata" è uno scroll-to-anchor lato client, non un filtro server-side
// con reload. A differenza di RosterJumpBar non c'è una giornata di
// default ovvia da preselezionare (non esiste un analogo della "squadra
// dell'utente"): niente scroll automatico al mount, solo al cambio.
'use client';

import type { MatchdayGroup } from '../../lib/queries/calendario';

function sectionId(number: number): string {
  return `giornata-${number}`;
}

type MatchdayJumpBarProps = {
  matchdays: Pick<MatchdayGroup, 'id' | 'number' | 'label'>[];
};

export function MatchdayJumpBar({ matchdays }: MatchdayJumpBarProps) {
  function handleChange(value: string) {
    if (!value) return;
    document.getElementById(sectionId(Number(value)))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <select
      defaultValue=""
      onChange={(event) => handleChange(event.target.value)}
      aria-label="Vai alla giornata"
      className="w-full sm:w-auto rounded-lg bg-white border border-stone-200 text-sm font-semibold text-brand-800 px-3 py-2"
    >
      <option value="" disabled>
        Vai alla giornata…
      </option>
      {matchdays.map((matchday) => (
        <option key={matchday.id} value={matchday.number}>
          {matchday.label ?? `Giornata ${matchday.number}`}
        </option>
      ))}
    </select>
  );
}
