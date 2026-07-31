'use client';

// apps/web/components/home/KeyPlayersCard.tsx
//
// Client Component isolato solo per la tendina "quanti mostrare": il resto
// di TeamPanel resta Server Component. Il server invia già fino a 30
// giocatori (getMostFieldedPlayers in lib/queries/home), quindi cambiare la
// selezione è solo uno slice locale, nessuna nuova query.
import { useState } from 'react';
import { Users } from 'lucide-react';
import { StatCard } from './StatCard';
import type { FieldedPlayer } from '../../lib/queries/home';

// tupla `as const`: COUNT_OPTIONS[0] resta un `number` noto a compile time,
// non `number | undefined` (noUncheckedIndexedAccess su un array normale).
const COUNT_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

export function KeyPlayersCard({ players }: { players: FieldedPlayer[] }) {
  const [count, setCount] = useState<number>(COUNT_OPTIONS[0]);

  if (players.length === 0) {
    return (
      <StatCard label="Giocatori chiave">
        <div className="text-sm text-stone-400">Ancora nessun dato</div>
      </StatCard>
    );
  }

  return (
    <StatCard label="Giocatori chiave">
      <div className="mb-1 flex items-center justify-between">
        <Users size={18} className="text-brand-500" />
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
      {/* max-h-28 = altezza esatta di 5 righe (misurata: 20px + 2px gap):
          oltre Top 5 scorre qui dentro, la tessera non si allunga e non
          spinge le altre tessere della riga (StatCard è h-full in una grid). */}
      <div className="relative">
        <ol
          className="max-h-28 space-y-0.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable] [scrollbar-color:var(--color-stone-300)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-track]:bg-transparent"
        >
          {players.slice(0, count).map((player, index) => (
            <li key={index} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-stone-800">
                {index + 1}. {player.playerName}
              </span>
              <span className="shrink-0 text-xs text-stone-500">{player.appearances}</span>
            </li>
          ))}
        </ol>
        {/* ponytail: fade fisso quando c'è overflow, non reagisce alla
            posizione di scroll (resterebbe visibile anche a fondo lista).
            Serve perché su mobile/macOS la scrollbar è overlay e quasi
            invisibile finché non si scrolla: senza indizio la lista
            sembrerebbe finire a 5 invece di continuare fino a `count`. */}
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
