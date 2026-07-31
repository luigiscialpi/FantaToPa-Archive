// apps/web/components/home/UnbeatenStreakCard.tsx
//
// "Serie utile più lunga": striscia più lunga di sempre senza sconfitte
// (vittoria o pareggio), solo campionato (getLongestUnbeatenStreak,
// lib/queries/home.ts — perché solo campionato, vedi commento lì). Server
// Component puro, singolo highlight come Rivale storico/Fuoriclasse della
// rosa — non una classifica.
import { Flame } from 'lucide-react';
import { StatCard } from './StatCard';
import type { UnbeatenStreak } from '../../lib/queries/home';

export function UnbeatenStreakCard({ streak }: { streak: UnbeatenStreak | null }) {
  const sameSeason = streak?.fromSeasonLabel === streak?.toSeasonLabel;

  return (
    <StatCard label="Serie utile più lunga">
      {streak ? (
        <>
          <Flame size={18} className="mb-1 text-orange-500" />
          <div className="text-sm font-semibold text-stone-800">{streak.length} giornate utili</div>
          <div className="text-xs text-stone-500">
            Dalla {streak.fromMatchdayNumber}ª ({streak.fromSeasonLabel}) alla {streak.toMatchdayNumber}ª
            {sameSeason ? '' : ` (${streak.toSeasonLabel})`}
          </div>
        </>
      ) : (
        <div className="text-sm text-stone-400">Ancora nessun dato</div>
      )}
    </StatCard>
  );
}
