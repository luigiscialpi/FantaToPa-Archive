// apps/web/components/formazioni/MatchdaySelector.tsx
//
// Riceve le opzioni come prop (la pagina le ha già da searchParams/query),
// niente useSearchParams() qui — solo useRouter() per navigare al cambio,
// stesso pattern di SeasonSwitcher.
'use client';

import { useRouter } from 'next/navigation';
import type { MatchdayOption } from '../../lib/queries/formazioni';

type MatchdaySelectorProps = {
  seasonSlug: string;
  competitionSlug: string;
  matchdays: MatchdayOption[];
  activeMatchdayNumber: number;
};

export function MatchdaySelector({ seasonSlug, competitionSlug, matchdays, activeMatchdayNumber }: MatchdaySelectorProps) {
  const router = useRouter();

  function handleChange(nextNumber: string) {
    router.push(`/stagioni/${seasonSlug}/formazioni?competizione=${competitionSlug}&giornata=${nextNumber}`);
  }

  return (
    <select
      value={activeMatchdayNumber}
      onChange={(event) => handleChange(event.target.value)}
      aria-label="Giornata"
      className="text-sm font-semibold text-brand-800 bg-white border border-stone-200 rounded-lg px-3 py-1.5"
    >
      {matchdays.map((matchday) => (
        <option key={matchday.id} value={matchday.number}>
          {matchday.label ?? `${matchday.number}ª giornata`}
        </option>
      ))}
    </select>
  );
}
