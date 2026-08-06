'use client';

// apps/web/components/home/RosterLoyaltyCard.tsx
//
// "Fedelissimi": in quante stagioni (anche non consecutive) un giocatore è
// stato in rosa per questa squadra (getRosterLoyalty, lib/queries/home.ts).
// Card separata da "Giocatori chiave" (più schierati) su richiesta esplicita
// dell'utente — il piano originale proponeva di far evolvere la stessa
// card, ma qui sono due metriche diverse mostrate fianco a fianco. Client
// Component per la stessa tendina "quanti mostrare" di KeyPlayersCard: il
// server invia già fino a 30 nomi (getRosterLoyalty), qui è solo uno slice
// locale, nessuna nuova query.
import { useState } from 'react';
import { Heart } from 'lucide-react';
import { StatCard } from './StatCard';
import type { RosterLoyaltyEntry } from '../../lib/queries/home';

// tupla `as const`: COUNT_OPTIONS[0] resta un `number` noto a compile time,
// non `number | undefined` (noUncheckedIndexedAccess su un array normale).
const COUNT_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

export function RosterLoyaltyCard({ loyalty }: { loyalty: RosterLoyaltyEntry[] }) {
  const [count, setCount] = useState<number>(COUNT_OPTIONS[0]);

  if (loyalty.length === 0) {
    return (
      <StatCard label="Fedelissimi">
        <div className="text-sm text-stone-400">Ancora nessun dato</div>
      </StatCard>
    );
  }

  return (
    <StatCard label="Fedelissimi">
      <div className="mb-1 flex items-center justify-between">
        <Heart size={18} className="text-rose-500" />
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
      {/* max-h-28 = altezza esatta di 5 righe, stesso trucco di
          KeyPlayersCard: oltre Top 5 scorre qui dentro, la tessera non si
          allunga e non spinge le altre della riga (StatCard è h-full in
          una grid). */}
      <div className="relative">
        <ol
          className="max-h-28 space-y-0.5 overflow-y-auto pr-1 [scrollbar-gutter:stable] [scrollbar-color:var(--color-stone-300)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-track]:bg-transparent"
        >
          {loyalty.slice(0, count).map((entry, index) => (
            <li key={index} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-stone-800">
                {index + 1}. {entry.playerName}
              </span>
              <span className="shrink-0 text-xs text-stone-500">{entry.seasonsCount} stag.</span>
            </li>
          ))}
        </ol>
        {/* ponytail: fade fisso quando c'è overflow, non reagisce alla
            posizione di scroll — stesso motivo di KeyPlayersCard (scrollbar
            overlay quasi invisibile su mobile/macOS finché non si scrolla). */}
        {count > 5 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-white to-transparent"
          />
        )}
      </div>
    </StatCard>
  );
}
