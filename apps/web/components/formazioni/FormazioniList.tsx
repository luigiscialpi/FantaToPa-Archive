// apps/web/components/formazioni/FormazioniList.tsx
//
// Client component: solo stato locale per l'espansione (prima partita
// aperta di default, le altre a scomparsa — riduce lo scroll dato che ogni
// partita mostra 2 formazioni complete di titolari+panchina).
'use client';

import { useState } from 'react';
import { MatchCard } from './MatchCard';
import type { FormazioniMatch } from '../../lib/queries/formazioni';

export function FormazioniList({ matches }: { matches: FormazioniMatch[] }) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(matches[0]?.matchId ?? null);

  return (
    <div>
      {matches.map((match) => (
        <MatchCard
          key={match.matchId}
          match={match}
          expanded={expandedMatchId === match.matchId}
          onToggle={() => setExpandedMatchId((current) => (current === match.matchId ? null : match.matchId))}
        />
      ))}
    </div>
  );
}
