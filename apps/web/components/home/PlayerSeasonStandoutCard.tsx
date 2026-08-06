'use client';

// apps/web/components/home/PlayerSeasonStandoutCard.tsx
//
// "Miglior stagione individuale": top N per media fantavoto di una singola
// stagione (getBestPlayerSeasons, lib/queries/home.ts) — a differenza di
// RosterStandoutCard (media di carriera), qui lo stesso giocatore può
// comparire più volte per annate diverse. Stessa tendina "quanti mostrare"
// di KeyPlayersCard/RosterStandoutCard.
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { StatCard } from './StatCard';
import type { PlayerSeasonStandout } from '../../lib/queries/home';

const COUNT_OPTIONS = [3, 5, 10, 15, 20, 25, 30] as const;

export function PlayerSeasonStandoutCard({ standouts }: { standouts: PlayerSeasonStandout[] }) {
  const [count, setCount] = useState<number>(COUNT_OPTIONS[0]);

  if (standouts.length === 0) {
    return (
      <StatCard label="Miglior stagione individuale">
        <div className="text-sm text-stone-400">Ancora nessun dato</div>
      </StatCard>
    );
  }

  return (
    <StatCard label="Miglior stagione individuale">
      <div className="mb-1 flex items-center justify-between">
        <Sparkles size={18} className="text-amber-500" />
        <select
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          aria-label="Quante stagioni mostrare"
          className="rounded border border-stone-300 bg-white px-1 py-0.5 text-xs text-stone-600"
        >
          {COUNT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              Top {option}
            </option>
          ))}
        </select>
      </div>
      {/* max-h-36/righe da due linee per le 3 righe di default: stessa
          scelta di RosterStandoutCard, "Stagione AAAA/AAAA" accanto a un
          nome lungo schiacciava il nome. */}
      <div className="relative">
        <ol className="max-h-36 space-y-1 overflow-y-auto pr-1 [scrollbar-gutter:stable] [scrollbar-color:var(--color-stone-300)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-track]:bg-transparent">
          {standouts.slice(0, count).map((standout, index) => (
            <li key={index}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-stone-800">
                  {index + 1}. {standout.playerName}
                </span>
                <span className="shrink-0 text-xs font-semibold text-stone-600">{standout.averageFantavoto}</span>
              </div>
              <div className="truncate text-[11px] text-stone-400">{standout.seasonLabel}</div>
            </li>
          ))}
        </ol>
        {count > 3 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-white to-transparent"
          />
        )}
      </div>
    </StatCard>
  );
}
