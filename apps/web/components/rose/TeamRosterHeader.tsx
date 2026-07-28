// apps/web/components/rose/TeamRosterHeader.tsx
//
// Header di sezione per ogni rosa nella pagina Rose, stesso linguaggio
// visivo della barra header di MatchCard (Formazioni): sfondo bg-brand-600,
// logo+maglia, nome squadra. In più, specifico di questa pagina: nome di chi
// gestisce la squadra (se presente, da team_managers()) e crediti residui
// asta (da team_seasons.credits_remaining).
import { TeamCrests } from '../shared/TeamCrests';

type TeamRosterHeaderProps = {
  teamName: string;
  logoUrl: string | null;
  jerseyUrl: string | null;
  managerName: string | null;
  creditsRemaining: number | null;
};

export function TeamRosterHeader({
  teamName,
  logoUrl,
  jerseyUrl,
  managerName,
  creditsRemaining,
}: TeamRosterHeaderProps) {
  return (
    <div className="bg-brand-600 text-stone-50 px-4 py-3 flex items-center gap-3">
      <TeamCrests name={teamName} logoUrl={logoUrl} jerseyUrl={jerseyUrl} />
      <div className="flex-1 min-w-0">
        <div className="font-serif font-bold text-base truncate">{teamName}</div>
        {managerName && <div className="text-xs text-brand-100 truncate">{managerName}</div>}
      </div>
      {creditsRemaining !== null && (
        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-wide text-brand-100">Crediti</div>
          <div className="font-serif font-bold text-lg text-amber-300 tabular-nums">{creditsRemaining}</div>
        </div>
      )}
    </div>
  );
}
