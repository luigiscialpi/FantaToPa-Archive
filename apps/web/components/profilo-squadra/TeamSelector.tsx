// apps/web/components/profilo-squadra/TeamSelector.tsx
//
// Select singola con navigazione immediata al cambio, stesso pattern di
// MatchdaySelector/SeasonSwitcher: qui c'è una sola dimensione di scelta
// (la squadra), non più select correlate come in StatisticheControls —
// niente bisogno del pulsante "Aggiorna" esplicito, un onChange non causa
// il problema "una query per ogni singola selezione" descritto in AGENTS.md
// (quello riguarda più filtri indipendenti sulla stessa pagina).
'use client';

import { useRouter } from 'next/navigation';
import type { TeamOption } from '../../lib/queries/teams';

type TeamSelectorProps = {
  teams: TeamOption[];
  activeTeamSlug: string;
};

export function TeamSelector({ teams, activeTeamSlug }: TeamSelectorProps) {
  const router = useRouter();

  function handleChange(slug: string) {
    router.push(`/profilo-squadra?squadra=${slug}`);
  }

  return (
    <div className="relative inline-flex items-center w-full sm:w-auto">
      <select
        value={activeTeamSlug}
        onChange={(event) => handleChange(event.target.value)}
        aria-label="Squadra"
        className="w-full sm:w-auto appearance-none rounded-lg bg-white text-brand-900 text-sm font-semibold pl-3 pr-8 py-1.5 border border-stone-200/90 shadow-2xs hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand-600/30 cursor-pointer transition-colors"
      >
        {teams.map((team) => (
          <option key={team.id} value={team.slug}>
            {team.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2.5 flex items-center text-brand-700">
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </div>
    </div>
  );
}
