// apps/web/components/calendario/MatchRow.tsx
import Link from 'next/link';
import { Crest } from '../shared/Crest';
import { updateMatchAction } from '../../lib/admin/calendario-actions';
import type { MatchRow as MatchRowData } from '../../lib/queries/calendario';

type MatchRowProps = {
  match: MatchRowData;
  seasonSlug: string;
  competitionSlug: string;
  matchdayNumber: number;
  editMode?: boolean;
};

export function MatchRow({ match, seasonSlug, competitionSlug, matchdayNumber, editMode = false }: MatchRowProps) {
  const hasScore = match.homeScore !== null || match.awayScore !== null;
  // #match-<id> per lo scroll client-side (ScrollToAnchor, già montato in
  // FormazioniPage) oltre a ?partita= per l'espansione lato server.
  const formazioniHref = `/stagioni/${seasonSlug}/formazioni?competizione=${competitionSlug}&giornata=${matchdayNumber}&partita=${match.id}#match-${match.id}`;

  // Il resto della pagina resta un <Link>: un <form> non può stare dentro
  // un <a> (contenuto interattivo annidato non valido), quindi in modifica
  // la riga diventa un <div> con un form vero e proprio invece del link.
  if (editMode) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 bg-amber-50/40">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Crest name={match.homeTeamName} imageUrl={match.homeJerseyUrl} />
          <span className="text-sm font-semibold text-stone-800 truncate">{match.homeTeamName}</span>
        </div>
        <form
          action={updateMatchAction.bind(null, match.id)}
          className="flex flex-wrap items-center justify-center gap-1.5 shrink-0"
        >
          <input
            type="number"
            name="homeGoals"
            defaultValue={match.homeGoals ?? ''}
            placeholder="Gol"
            className="w-12 rounded border border-stone-300 text-xs px-1.5 py-1 text-center tabular-nums"
          />
          {match.awayTeamName && (
            <>
              <span className="text-stone-400">-</span>
              <input
                type="number"
                name="awayGoals"
                defaultValue={match.awayGoals ?? ''}
                placeholder="Gol"
                className="w-12 rounded border border-stone-300 text-xs px-1.5 py-1 text-center tabular-nums"
              />
            </>
          )}
          <span className="text-stone-300 px-1">|</span>
          <input
            type="number"
            step="0.5"
            name="homeScore"
            defaultValue={match.homeScore ?? ''}
            placeholder="Fvoto"
            className="w-14 rounded border border-stone-300 text-xs px-1.5 py-1 text-center tabular-nums"
          />
          {match.awayTeamName && (
            <>
              <span className="text-stone-400">-</span>
              <input
                type="number"
                step="0.5"
                name="awayScore"
                defaultValue={match.awayScore ?? ''}
                placeholder="Fvoto"
                className="w-14 rounded border border-stone-300 text-xs px-1.5 py-1 text-center tabular-nums"
              />
            </>
          )}
          <button type="submit" className="rounded bg-brand-400 text-brand-950 text-xs font-semibold px-2 py-1">
            Salva
          </button>
        </form>
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
      </div>
    );
  }

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
