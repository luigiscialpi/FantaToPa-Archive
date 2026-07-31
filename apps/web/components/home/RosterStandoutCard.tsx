// apps/web/components/home/RosterStandoutCard.tsx
//
// "Fuoriclasse della rosa": chi ha la media fantavoto più alta fra chi conta
// per il totale squadra, con almeno un numero minimo di presenze
// (getRosterStandout, lib/queries/home.ts, MIN_APPEARANCES_FOR_STANDOUT) per
// non far vincere un exploit da una sola giornata. Server Component puro,
// singolo highlight come Rivale storico — non una classifica.
import { Star } from 'lucide-react';
import { StatCard } from './StatCard';
import type { RosterStandout } from '../../lib/queries/home';

export function RosterStandoutCard({ standout }: { standout: RosterStandout | null }) {
  return (
    <StatCard label="Fuoriclasse della rosa">
      {standout ? (
        <>
          <Star size={18} className="mb-1 text-amber-500" />
          <div className="truncate text-sm font-semibold text-stone-800">{standout.playerName}</div>
          <div className="text-xs text-stone-500">
            Media <strong className="text-stone-700">{standout.averageFantavoto}</strong> su {standout.appearances} presenze
          </div>
        </>
      ) : (
        <div className="text-sm text-stone-400">Ancora nessun dato</div>
      )}
    </StatCard>
  );
}
