// apps/web/components/rose/RosterTable.tsx
import type { RosterPlayerRow } from '../../lib/queries/rose';

function RoleBadges({ roleCodes }: { roleCodes: string[] }) {
  if (roleCodes.length === 0) {
    return <span className="text-stone-400">–</span>;
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {roleCodes.map((code) => (
        <span
          key={code}
          className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-brand-100 text-brand-700"
        >
          {code}
        </span>
      ))}
    </div>
  );
}

export function RosterTable({ players }: { players: RosterPlayerRow[] }) {
  if (players.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 px-4 py-8 text-center text-sm text-stone-500">
        Rosa non disponibile per questa squadra.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
            <th scope="col" className="px-2 py-2 text-left font-semibold whitespace-nowrap">
              Ruolo
            </th>
            <th scope="col" className="px-2 py-2 text-left font-semibold whitespace-nowrap">
              Calciatore
            </th>
            <th scope="col" className="px-2 py-2 text-left font-semibold whitespace-nowrap">
              Squadra
            </th>
            <th scope="col" className="px-2 py-2 text-right font-semibold whitespace-nowrap">
              Costo
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.playerId} className="border-t border-stone-100 first:border-t-0">
              <td className="px-2 py-2">
                <RoleBadges roleCodes={player.roleCodes} />
              </td>
              <td className="px-2 py-2 text-sm font-semibold text-stone-800 whitespace-nowrap">
                {player.playerName}
              </td>
              <td className="px-2 py-2 text-stone-500 whitespace-nowrap">{player.realTeam ?? '–'}</td>
              <td className="px-2 py-2 text-right tabular-nums text-stone-600">{player.cost ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
