// apps/web/components/calendario/MatchRow.tsx
import { Crest } from '../shared/Crest';
import type { MatchRow as MatchRowData } from '../../lib/queries/calendario';

export function MatchRow({ match }: { match: MatchRowData }) {
  const hasGoals = match.homeGoals !== null && match.awayGoals !== null;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <Crest name={match.homeTeamName} imageUrl={match.homeJerseyUrl} />
        <span className="text-sm font-semibold text-stone-800 truncate">{match.homeTeamName}</span>
      </div>
      <div className="shrink-0 text-center px-2">
        <div className="font-serif font-bold text-lg text-brand-800 tabular-nums whitespace-nowrap">
          {match.homeScore ?? '–'} - {match.awayScore ?? '–'}
        </div>
        {hasGoals && (
          <div className="text-xs text-stone-400 tabular-nums">
            {match.homeGoals} - {match.awayGoals}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2 justify-end">
        <span className="text-sm font-semibold text-stone-800 truncate text-right">{match.awayTeamName}</span>
        <Crest name={match.awayTeamName} imageUrl={match.awayJerseyUrl} />
      </div>
    </div>
  );
}
