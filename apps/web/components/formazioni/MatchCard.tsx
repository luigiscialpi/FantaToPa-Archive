// apps/web/components/formazioni/MatchCard.tsx
import { TeamCrests } from '../shared/TeamCrests';
import { LineupColumn } from './LineupColumn';
import type { FormazioniMatch } from '../../lib/queries/formazioni';

type MatchCardProps = {
  match: FormazioniMatch;
  expanded: boolean;
  onToggle: () => void;
};

export function MatchCard({ match, expanded, onToggle }: MatchCardProps) {
  const { home, away } = match;

  return (
    <div className="mb-4 rounded-xl bg-white border border-stone-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full bg-brand-600 text-stone-50 px-4 py-3 flex items-center gap-3 cursor-pointer"
      >
        <TeamCrests name={home.teamName} logoUrl={home.logoUrl} jerseyUrl={home.jerseyUrl} />
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs font-medium truncate">{home.teamName}</div>
        </div>
        <div className="font-serif font-bold text-lg text-amber-300 tabular-nums shrink-0 px-2">
          {home.totalScore ?? '–'} - {away.totalScore ?? '–'}
        </div>
        <div className="flex-1 min-w-0 text-right">
          <div className="text-xs font-medium truncate">{away.teamName}</div>
        </div>
        <TeamCrests name={away.teamName} logoUrl={away.logoUrl} jerseyUrl={away.jerseyUrl} />
      </button>

      {expanded && (
        <div className="px-4 py-3 flex flex-row gap-3 sm:gap-6">
          <LineupColumn lineup={home} />
          <div className="w-px bg-stone-200 shrink-0" />
          <LineupColumn lineup={away} />
        </div>
      )}
    </div>
  );
}
