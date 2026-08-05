// apps/web/components/formazioni/MatchdaySelector.tsx
//
// Riceve le opzioni come prop (la pagina le ha già da searchParams/query),
// niente useSearchParams() qui — solo useRouter() per navigare al cambio,
// stesso pattern di SeasonSwitcher.
'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import type { MatchdayOption } from '../../lib/queries/formazioni';

type MatchdaySelectorProps = {
  seasonSlug: string;
  competitionSlug: string;
  matchdays: MatchdayOption[];
  activeMatchdayNumber: number;
};

export function MatchdaySelector({ seasonSlug, competitionSlug, matchdays, activeMatchdayNumber }: MatchdaySelectorProps) {
  const router = useRouter();
  // isPending resta vero finché la nuova giornata non è renderizzata: fino a
  // quel momento la pagina mostra ancora quella vecchia, quindi senza
  // spinner il cambio select sembra non aver fatto nulla.
  const [isPending, startTransition] = useTransition();

  function handleChange(nextNumber: string) {
    startTransition(() => {
      router.push(`/stagioni/${seasonSlug}/formazioni?competizione=${competitionSlug}&giornata=${nextNumber}`);
    });
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={activeMatchdayNumber}
        onChange={(event) => handleChange(event.target.value)}
        disabled={isPending}
        aria-busy={isPending}
        aria-label="Giornata"
        className="appearance-none rounded-lg bg-white text-brand-900 text-xs sm:text-sm font-semibold pl-3 pr-8 py-1.5 border border-stone-200/90 shadow-2xs hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand-600/30 cursor-pointer transition-colors disabled:opacity-70 disabled:cursor-wait"
      >
        {matchdays.map((matchday) => (
          <option key={matchday.id} value={matchday.number}>
            {matchday.label ?? `${matchday.number}ª giornata`}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2.5 flex items-center text-brand-700">
        {isPending ? (
          <LoaderCircle size={14} role="status" aria-label="Caricamento in corso" className="animate-spin" />
        ) : (
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        )}
      </div>
    </div>
  );
}
