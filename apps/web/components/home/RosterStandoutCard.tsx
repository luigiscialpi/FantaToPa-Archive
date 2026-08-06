'use client';

// apps/web/components/home/RosterStandoutCard.tsx
//
// "Fuoriclasse della rosa": top N per media fantavoto di carriera (tutte le
// stagioni in questa squadra sommate) fra chi conta per il totale squadra,
// con almeno un numero minimo di presenze (getRosterStandout,
// lib/queries/home.ts, MIN_APPEARANCES_FOR_STANDOUT) per non far vincere un
// exploit da una sola giornata. Tendina "quanti mostrare" come
// KeyPlayersCard — Client Component per lo stesso motivo (stato locale,
// nessuna nuova query).
import { useState } from 'react';
import { Star } from 'lucide-react';
import { StatCard } from './StatCard';
import type { RosterStandout } from '../../lib/queries/home';

const COUNT_OPTIONS = [3, 5, 10, 15, 20, 25, 30] as const;

export function RosterStandoutCard({ standouts }: { standouts: RosterStandout[] }) {
  const [count, setCount] = useState<number>(COUNT_OPTIONS[0]);

  if (standouts.length === 0) {
    return (
      <StatCard label="Fuoriclasse della rosa">
        <div className="text-sm text-stone-400">Ancora nessun dato</div>
      </StatCard>
    );
  }

  return (
    <StatCard label="Fuoriclasse della rosa">
      <div className="mb-1 flex items-center justify-between">
        <Star size={18} className="text-amber-500" />
        <select
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          aria-label="Quanti giocatori mostrare"
          className="rounded border border-stone-300 bg-white px-1 py-0.5 text-xs text-stone-600"
        >
          {COUNT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              Top {option}
            </option>
          ))}
        </select>
      </div>
      {/* max-h-36 = altezza misurata per le 3 righe di default (COUNT_OPTIONS[0]),
          righe da DUE linee ciascuna (nome+media, poi intervallo stagioni
          sotto): a differenza di KeyPlayersCard l'intervallo può essere
          lungo ("Stagione 2017/2018 – 2021/2022") e su una riga sola
          schiacciava il nome fino a troncarlo a 1-2 lettere. */}
      <div className="relative">
        <ol className="max-h-36 space-y-1 overflow-y-auto pr-1 [scrollbar-gutter:stable] [scrollbar-color:var(--color-stone-300)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-track]:bg-transparent">
          {standouts.slice(0, count).map((standout, index) => {
            const sameSeason = standout.fromSeasonLabel === standout.toSeasonLabel;
            // Le label sono già "Stagione AAAA/AAAA": per l'intervallo si
            // toglie il prefisso ripetuto, altrimenti leggerebbe "Stagione
            // X-Stagione Y".
            const range = sameSeason
              ? standout.fromSeasonLabel
              : `${standout.fromSeasonLabel} – ${standout.toSeasonLabel.replace(/^Stagione\s+/, '')}`;
            return (
              <li key={index}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-stone-800">
                    {index + 1}. {standout.playerName}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-stone-600">{standout.averageFantavoto}</span>
                </div>
                <div className="truncate text-[11px] text-stone-400">{range}</div>
              </li>
            );
          })}
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

