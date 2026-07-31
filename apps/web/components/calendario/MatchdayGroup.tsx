// apps/web/components/calendario/MatchdayGroup.tsx
import { MatchRow } from './MatchRow';
import type { MatchdayGroup as MatchdayGroupData } from '../../lib/queries/calendario';

export function MatchdayGroup({ matchday }: { matchday: MatchdayGroupData }) {
  return (
    <div
      id={`giornata-${matchday.number}`}
      className="mb-4 rounded-xl bg-white border border-stone-200 overflow-hidden scroll-mt-28"
    >
      <div className="px-4 py-2 bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-500">
        {matchday.label ?? `Giornata ${matchday.number}`}
      </div>
      {matchday.matches.length === 0 ? (
        <p className="px-4 py-3 text-sm text-stone-400">Nessuna partita</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {matchday.matches.map((match) => (
            <MatchRow key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
