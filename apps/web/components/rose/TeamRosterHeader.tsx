// apps/web/components/rose/TeamRosterHeader.tsx
//
// Header di sezione per ogni rosa nella pagina Rose, stesso linguaggio
// visivo della barra header di MatchCard (Formazioni): sfondo bg-brand-600,
// logo+maglia, nome squadra. In più, specifico di questa pagina: nome di chi
// gestisce la squadra (se presente, da team_managers()) e crediti residui
// asta (da team_seasons.credits_remaining).
import { TeamCrests } from '../shared/TeamCrests';
import { SaveButton } from '../shared/SaveButton';
import { updateTeamCreditsAction } from '../../lib/admin/rose-actions';

type TeamRosterHeaderProps = {
  teamName: string;
  logoUrl: string | null;
  jerseyUrl: string | null;
  managerName: string | null;
  creditsRemaining: number | null;
  seasonId: string;
  teamId: string;
  editMode?: boolean;
};

export function TeamRosterHeader({
  teamName,
  logoUrl,
  jerseyUrl,
  managerName,
  creditsRemaining,
  seasonId,
  teamId,
  editMode = false,
}: TeamRosterHeaderProps) {
  return (
    <div className="bg-brand-600 text-stone-50 px-4 py-3 flex items-center gap-3">
      <TeamCrests name={teamName} logoUrl={logoUrl} jerseyUrl={jerseyUrl} />
      <div className="flex-1 min-w-0">
        <div className="font-serif font-bold text-base truncate">{teamName}</div>
        {managerName && <div className="text-xs text-brand-100 truncate">{managerName}</div>}
      </div>
      {editMode ? (
        <form
          id={`team-credits-${teamId}`}
          action={updateTeamCreditsAction.bind(null, seasonId, teamId)}
          className="shrink-0 flex items-end flex-col gap-1"
        >
          <label className="text-[10px] uppercase tracking-wide text-brand-100">Crediti</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="1"
              name="creditsRemaining"
              defaultValue={creditsRemaining ?? ''}
              className="w-16 rounded border border-brand-300 text-stone-900 text-sm px-1.5 py-0.5 text-center tabular-nums"
            />
            <SaveButton
              formId={`team-credits-${teamId}`}
              resetKey={String(creditsRemaining)}
              pendingLabel="Salvo…"
              className="rounded bg-amber-300 text-brand-950 text-xs font-semibold px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Salva
            </SaveButton>
          </div>
        </form>
      ) : (
        creditsRemaining !== null && (
          <div className="shrink-0 text-right">
            <div className="text-[10px] uppercase tracking-wide text-brand-100">Crediti</div>
            <div className="font-serif font-bold text-lg text-amber-300 tabular-nums">{creditsRemaining}</div>
          </div>
        )
      )}
    </div>
  );
}
