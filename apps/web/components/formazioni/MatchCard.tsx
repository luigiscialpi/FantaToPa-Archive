// apps/web/components/formazioni/MatchCard.tsx
//
// Header sfida: risultato reale (gol) in evidenza, punteggio fantacalcio
// sotto in piccolo (prima era l'inverso, solo punteggio) — vedi
// matches.home_goals/away_goals, popolati dal campo "risultato" del
// calendario xlsx, non derivati dal fantavoto.
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
    <div id={`match-${match.matchId}`} className="mb-4 rounded-xl bg-white border border-stone-200 overflow-hidden scroll-mt-28">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full bg-brand-600 text-stone-50 px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-4 cursor-pointer"
      >
        <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
          <TeamCrests name={home.teamName} logoUrl={home.logoUrl} jerseyUrl={home.jerseyUrl} size="lg" />
          <span className="text-xs font-medium truncate max-w-full">{home.teamName}</span>
          <span className="text-[11px] text-brand-100/80 tabular-nums">{home.formation ?? '—'}</span>
        </div>

        <div className="shrink-0 flex flex-col items-center px-1">
          {away ? (
            <>
              <div className="font-serif font-bold text-2xl text-amber-300 tabular-nums whitespace-nowrap">
                {match.homeGoals ?? '–'} - {match.awayGoals ?? '–'}
              </div>
              <div className="text-xs text-brand-100/80 tabular-nums whitespace-nowrap">
                {home.totalScore ?? '–'} - {away.totalScore ?? '–'}
              </div>
            </>
          ) : (
            // Girone con numero dispari di squadre: nessun avversario questa giornata.
            <div className="font-serif font-bold text-2xl text-amber-300 tabular-nums whitespace-nowrap">{home.totalScore ?? '–'}</div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
          {away ? (
            <>
              <TeamCrests name={away.teamName} logoUrl={away.logoUrl} jerseyUrl={away.jerseyUrl} size="lg" />
              <span className="text-xs font-medium truncate max-w-full">{away.teamName}</span>
              <span className="text-[11px] text-brand-100/80 tabular-nums">{away.formation ?? '—'}</span>
            </>
          ) : (
            <span className="text-xs text-brand-100/80">Riposo</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 flex flex-row gap-3 sm:gap-6">
          <LineupColumn lineup={home} />
          {away && (
            <>
              <div className="w-px bg-stone-200 shrink-0" />
              <LineupColumn lineup={away} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

