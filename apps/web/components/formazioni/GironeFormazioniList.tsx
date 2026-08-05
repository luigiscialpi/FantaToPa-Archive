// apps/web/components/formazioni/GironeFormazioniList.tsx
//
// Griglia 1/2 colonne (una squadra affiancata all'altra su schermi larghi,
// stessa densità visiva delle vecchie MatchCard), ma ogni card è una
// squadra a sé — non una sfida 1 contro 1 (vedi getGironeFormazioni).
// Nessuno stato di espansione: tutte le squadre sono già aperte, come in
// /rose.
import { GironeTeamCard } from './GironeTeamCard';
import type { TeamLineup } from '../../lib/queries/formazioni';

export function GironeFormazioniList({
  teams,
  editMode = false,
  bonusKinds = [],
}: {
  teams: TeamLineup[];
  editMode?: boolean;
  bonusKinds?: { code: string; label: string }[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {teams.map((team, index) => (
        <GironeTeamCard key={team.teamId} rank={index + 1} lineup={team} editMode={editMode} bonusKinds={bonusKinds} />
      ))}
    </div>
  );
}
