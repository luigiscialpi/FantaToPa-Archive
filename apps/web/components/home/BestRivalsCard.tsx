// apps/web/components/home/BestRivalsCard.tsx
//
// "Migliori avversari": top 3 squadre contro cui l'utente ha il
// miglior record (più vittorie + pareggi). Server Component puro,
// stessa struttura di RosterStandoutCard / UnbeatenStreakCard.
import { CircleCheck } from 'lucide-react';
import { StatCard } from './StatCard';
import type { OpponentRecord } from '../../lib/queries/home';

export function BestRivalsCard({ records }: { records: OpponentRecord[] }) {
  return (
    <StatCard label="Migliori avversari">
      {records.length === 0 ? (
        <div className="text-sm text-stone-400">Ancora nessun dato</div>
      ) : (
        <>
          <CircleCheck size={18} className="mb-1 text-emerald-600" />
          <ol className="space-y-1">
          {records.map((record, index) => (
            <li key={index} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-stone-800">
                {index + 1}. {record.opponentName}
              </span>
              <span className="shrink-0 text-xs text-stone-500">
                {record.won}V {record.drawn}N {record.lost}P
              </span>
            </li>
          ))}
        </ol>
          </>
        )}
    </StatCard>
  );
}