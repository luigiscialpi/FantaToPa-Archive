// apps/web/components/formazioni/LineupColumn.tsx
import { PlayerRow } from "./PlayerRow";
import type { TeamLineup } from "../../lib/queries/formazioni";

// "2025-08-29T18:06:24" -> "29/08/2025 18:06". Manipolazione di stringa, non
// un oggetto Date: il dato è già l'orario "as-is" del file sorgente (colonna
// Postgres `timestamp` senza fuso) e non va reinterpretato in un altro fuso
// orario in fase di rendering.
function formatSubmittedAt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, yyyy, mm, dd, hh, min] = m;
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function LineupColumn({
  lineup,
  editMode = false,
  bonusKinds = [],
}: {
  lineup: TeamLineup;
  editMode?: boolean;
  bonusKinds?: { code: string; label: string }[];
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-center mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 text-center">
          Titolari
        </span>
      </div>

      {lineup.starters.length === 0 ? (
        <p className="text-xs text-stone-400 text-center">Formazione non disponibile</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {lineup.starters.map((player) => (
            <PlayerRow
              key={player.playerId}
              player={player}
              editMode={editMode}
              bonusKinds={bonusKinds}
              bonusMatchdayId={lineup.bonusMatchdayId}
            />
          ))}
        </div>
      )}

      {lineup.bench.length > 0 && (
        <>
          <div className="mt-3 mb-1.5 pt-2 border-t border-stone-200 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Panchina
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {lineup.bench.map((player) => (
              <PlayerRow
                key={player.playerId}
                player={player}
                editMode={editMode}
                bonusKinds={bonusKinds}
                bonusMatchdayId={lineup.bonusMatchdayId}
              />
            ))}
          </div>
        </>
      )}

      {lineup.defenseModifier !== 0 && (
        <div className="mt-3 mb-1.5 pt-2 border-t border-stone-200">
          <span className="text-sm text-stone-700 tabular-nums">
            Modificatore di difesa: {lineup.defenseModifier > 0 ? "+" : ""}
            {lineup.defenseModifier}
          </span>
        </div>
      )}

      {lineup.fieldAdvantage !== 0 && (
        <div className="mt-3 mb-1.5 pt-2 border-t border-stone-200">
          <span className="text-sm text-stone-700 tabular-nums">
            Fattore campo: {lineup.fieldAdvantage > 0 ? "+" : ""}
            {lineup.fieldAdvantage}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-200">
        {lineup.submittedVia && lineup.submittedAt ? (
          <span className="text-[11px] text-stone-400">
            Inserita via {lineup.submittedVia} il{" "}
            {formatSubmittedAt(lineup.submittedAt)}
          </span>
        ) : (
          <span />
        )}
        <div className="rounded-lg bg-brand-800 text-amber-300 font-serif font-bold text-lg px-3 py-1 tabular-nums">
          {lineup.totalScore ?? "–"}
        </div>
      </div>
    </div>
  );
}
