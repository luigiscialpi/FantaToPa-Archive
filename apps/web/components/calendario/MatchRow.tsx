// apps/web/components/calendario/MatchRow.tsx
import Link from 'next/link';
import { Crest } from '../shared/Crest';
import type { MatchRow as MatchRowData } from '../../lib/queries/calendario';

type MatchRowProps = {
  match: MatchRowData;
  seasonSlug: string;
  competitionSlug: string;
  matchdayNumber: number;
};

export function MatchRow({ match, seasonSlug, competitionSlug, matchdayNumber }: MatchRowProps) {
  const hasScore = match.homeScore !== null || match.awayScore !== null;
  // #match-<id> per lo scroll client-side (ScrollToAnchor, già montato in
  // FormazioniPage) oltre a ?partita= per l'espansione lato server.
  const formazioniHref = `/stagioni/${seasonSlug}/formazioni?competizione=${competitionSlug}&giornata=${matchdayNumber}&partita=${match.id}#match-${match.id}`;

  return (
    <Link href={formazioniHref} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors">
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <Crest name={match.homeTeamName} imageUrl={match.homeJerseyUrl} />
        <span className="text-sm font-semibold text-stone-800 truncate">{match.homeTeamName}</span>
      </div>
      <div className="shrink-0 text-center px-2">
        <div className="font-serif font-bold text-lg text-brand-800 tabular-nums whitespace-nowrap">
          {match.homeGoals ?? '–'} - {match.awayGoals ?? '–'}
        </div>
        {hasScore && (
          <div className="text-xs text-stone-400 tabular-nums">
            {match.homeScore ?? '–'} - {match.awayScore ?? '–'}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2 justify-end">
        {match.awayTeamName ? (
          <>
            <span className="text-sm font-semibold text-stone-800 truncate text-right">{match.awayTeamName}</span>
            <Crest name={match.awayTeamName} imageUrl={match.awayJerseyUrl} />
          </>
        ) : (
          <span className="text-sm text-stone-400 truncate text-right">Riposo</span>
        )}
      </div>
    </Link>
  );
}
