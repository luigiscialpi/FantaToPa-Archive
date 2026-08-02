// apps/web/components/calendario/GironeMatchdayGroup.tsx
//
// Coppa Girone A/B (format_code 'gironi'): "formula uno" come in
// GironeFormazioniList/GironeTeamCard — ogni giornata è una classifica di
// giornata (punteggi di tutte le squadre in ordine), non un elenco di
// partite home/away con avversari inventati. Vedi getGironeCalendario in
// lib/queries/calendario.ts.
import Link from 'next/link';
import { Crest } from '../shared/Crest';
import type { GironeMatchdayGroup as GironeMatchdayGroupData } from '../../lib/queries/calendario';

type GironeMatchdayGroupProps = {
  matchday: GironeMatchdayGroupData;
  seasonSlug: string;
  competitionSlug: string;
};

export function GironeMatchdayGroup({ matchday, seasonSlug, competitionSlug }: GironeMatchdayGroupProps) {
  const formazioniHref = `/stagioni/${seasonSlug}/formazioni?competizione=${competitionSlug}&giornata=${matchday.number}`;

  return (
    <div
      id={`giornata-${matchday.number}`}
      className="mb-4 rounded-xl bg-white border border-stone-200 overflow-hidden scroll-mt-28"
    >
      <div className="px-4 py-2 bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-500">
        {matchday.label ?? `Giornata ${matchday.number}`}
      </div>
      {matchday.teams.length === 0 ? (
        <p className="px-4 py-3 text-sm text-stone-400">Nessuna partita</p>
      ) : (
        <Link href={formazioniHref} className="block divide-y divide-stone-100 hover:bg-stone-50 transition-colors">
          {matchday.teams.map((team, index) => (
            <div key={`${team.matchId}-${team.teamName}`} className="flex items-center gap-3 px-4 py-3">
              <span className="shrink-0 w-5 text-right text-xs font-semibold text-stone-400 tabular-nums">
                {index + 1}º
              </span>
              <Crest name={team.teamName} imageUrl={team.jerseyUrl} />
              <span className="flex-1 min-w-0 text-sm font-semibold text-stone-800 truncate">{team.teamName}</span>
              <span className="shrink-0 font-serif font-bold text-base text-brand-800 tabular-nums">
                {team.score ?? '–'}
              </span>
            </div>
          ))}
        </Link>
      )}
    </div>
  );
}
