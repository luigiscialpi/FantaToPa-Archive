// apps/web/components/rose/RosterJumpBar.tsx
//
// Sostituisce TeamSwitcher: le rose non sono più pagine alternative dietro
// un query param, sono tutte nella stessa pagina una sotto l'altra — quindi
// qui non si naviga, si scrolla alla sezione #squadra-<slug> corrispondente.
// All'apertura della pagina scrolla già alla rosa di default (utente loggato
// o Prozalpi), così non si parte dalla prima squadra in ordine alfabetico.
'use client';

import { useEffect, useRef } from 'react';
import type { TeamOption } from '../../lib/queries/rose';

function sectionId(slug: string): string {
  return `squadra-${slug}`;
}

function scrollToTeam(slug: string, behavior: ScrollBehavior) {
  document.getElementById(sectionId(slug))?.scrollIntoView({ behavior, block: 'start' });
}

type RosterJumpBarProps = {
  teams: TeamOption[];
  defaultTeamSlug: string;
};

export function RosterJumpBar({ teams, defaultTeamSlug }: RosterJumpBarProps) {
  const hasScrolledOnMount = useRef(false);

  useEffect(() => {
    if (hasScrolledOnMount.current) return;
    hasScrolledOnMount.current = true;
    // Un hash già in URL (es. /rose#squadra-<slug> linkato da Classifica)
    // indica un punto di arrivo esplicito: non sovrascriverlo con la squadra
    // di default, altrimenti il link mirato smette di funzionare. In quel
    // caso ci pensa ScrollToAnchor, montato in RosePage.
    if (window.location.hash) return;
    // 'auto' (non 'smooth'): al caricamento si vuole arrivare già
    // posizionati, non guardare un'animazione lungo tutta la pagina.
    scrollToTeam(defaultTeamSlug, 'auto');
  }, [defaultTeamSlug]);

  return (
    <select
      defaultValue={defaultTeamSlug}
      onChange={(event) => scrollToTeam(event.target.value, 'smooth')}
      aria-label="Vai alla rosa"
      className="w-full sm:w-auto rounded-lg bg-white border border-stone-200 text-sm font-semibold text-brand-800 px-3 py-2"
    >
      {teams.map((team) => (
        <option key={team.id} value={team.slug}>
          {team.name}
        </option>
      ))}
    </select>
  );
}
