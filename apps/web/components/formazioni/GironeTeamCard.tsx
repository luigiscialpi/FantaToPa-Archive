// apps/web/components/formazioni/GironeTeamCard.tsx
//
// Una squadra alla volta (Coppa Girone A/B, "formula uno" — vedi
// getGironeFormazioni in lib/queries/formazioni.ts): stesso linguaggio
// visivo dell'header di MatchCard, ma senza avversario/punteggio a
// confronto. Il contenuto (titolari, panchina, modificatori, punteggio)
// riusa LineupColumn invariato.
import { TeamCrests } from '../shared/TeamCrests';
import { LineupColumn } from './LineupColumn';
import type { TeamLineup } from '../../lib/queries/formazioni';

type GironeTeamCardProps = {
  rank: number;
  lineup: TeamLineup;
  editMode?: boolean;
  bonusKinds?: { code: string; label: string }[];
};

export function GironeTeamCard({ rank, lineup, editMode = false, bonusKinds = [] }: GironeTeamCardProps) {
  return (
    <div className="rounded-xl bg-white border border-stone-200 overflow-hidden">
      <div className="bg-brand-600 text-stone-50 px-3 sm:px-4 py-3 flex items-center gap-3">
        <span className="shrink-0 w-6 text-center font-serif font-bold text-lg text-amber-300 tabular-nums">
          {rank}º
        </span>
        <TeamCrests name={lineup.teamName} logoUrl={lineup.logoUrl} jerseyUrl={lineup.jerseyUrl} />
        <div className="flex-1 min-w-0">
          <div className="font-serif font-bold text-base truncate">{lineup.teamName}</div>
          <div className="text-xs text-brand-100/80 tabular-nums">{lineup.formation ?? '—'}</div>
        </div>
      </div>
      <div className="px-3 sm:px-4 py-3">
        <LineupColumn lineup={lineup} editMode={editMode} bonusKinds={bonusKinds} />
      </div>
    </div>
  );
}
