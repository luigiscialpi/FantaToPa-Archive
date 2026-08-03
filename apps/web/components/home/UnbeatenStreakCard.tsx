// apps/web/components/home/UnbeatenStreakCard.tsx
//
// "Serie utile più lunga": striscia più lunga di sempre senza sconfitte
// (vittoria o pareggio), entro una singola stagione, solo campionato
// (getLongestUnbeatenStreak, lib/queries/home.ts). Porta anche il record di
// vittorie consecutive: calcolato indipendentemente e non necessariamente
// nella stessa stagione della striscia utile, quindi con una propria
// seasonLabel. Server Component puro, singolo highlight come Rivale
// storico/Fuoriclasse della rosa — non una classifica.
import { Flame } from 'lucide-react';
import { StatCard } from './StatCard';
import type { UnbeatenStreak } from '../../lib/queries/home';

export function UnbeatenStreakCard({ streak }: { streak: UnbeatenStreak | null }) {
  return (
    <StatCard label="Serie utile più lunga">
      {streak ? (
        <>
          <Flame size={18} className="mb-1 text-orange-500" />
          <div className="text-sm font-semibold text-stone-800">{streak.length} giornate utili</div>
          <div className="text-xs text-stone-500">
            Dalla {streak.fromMatchdayNumber}ª alla {streak.toMatchdayNumber}ª ({streak.seasonLabel})
          </div>
          <div className="mt-1 text-xs text-stone-500">
            Record vittorie consecutive:{' '}
            <strong className="text-stone-700">{streak.longestWinningStreak?.length ?? 0}</strong>
            {streak.longestWinningStreak && ` (${streak.longestWinningStreak.seasonLabel})`}
          </div>
        </>
      ) : (
        <div className="text-sm text-stone-400">Ancora nessun dato</div>
      )}
    </StatCard>
  );
}
