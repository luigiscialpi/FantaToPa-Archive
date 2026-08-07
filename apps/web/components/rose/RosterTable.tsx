// apps/web/components/rose/RosterTable.tsx
import type { RosterPlayerRow } from '../../lib/queries/rose';
import { updateRosterPlayerAction } from '../../lib/admin/rose-actions';
import { SaveButton } from '../shared/SaveButton';

function RoleBadges({ roleCodes }: { roleCodes: string[] }) {
  if (roleCodes.length === 0) {
    return <span className="text-stone-400">–</span>;
  }

  return (
    <div className="flex gap-1 flex-wrap justify-start sm:justify-center">
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

export function RosterTable({ players, editMode = false }: { players: RosterPlayerRow[]; editMode?: boolean }) {
  if (players.length === 0) {
    return <div className="bg-white px-4 py-8 text-center text-sm text-stone-500">Rosa non disponibile per questa squadra.</div>;
  }

  return (
    <div className="bg-white overflow-x-auto">
      <table className="w-full table-fixed text-left text-xs sm:text-center">
        <colgroup>
          <col className="w-[15%]" />
          <col className="w-[40%]" />
          <col className="w-[30%]" />
          <col className="w-[15%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
            <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
              Ruolo
            </th>
            <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
              Calciatore
            </th>
            <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
              Squadra
            </th>
            <th scope="col" className="px-2 py-2 text-right font-semibold whitespace-nowrap sm:text-center">
              Costo
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            if (!editMode) {
              return (
                <tr key={player.playerId} className="border-t border-stone-100 first:border-t-0">
                  <td className="px-2 py-2">
                    <RoleBadges roleCodes={player.roleCodes} />
                  </td>
                  <td className="px-2 py-2 text-sm font-semibold text-stone-800 whitespace-nowrap">
                    {player.playerName}
                  </td>
                  <td className="px-2 py-2 text-stone-500 whitespace-nowrap">{player.realTeam ?? '–'}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-600 sm:text-center">{player.cost ?? '–'}</td>
                </tr>
              );
            }

            // Ruolo non editabile qui: player_roles è per (giocatore,
            // stagione), condiviso fra tutte le squadre — non un dato di
            // questa rosa.
            const formId = `rosa-${player.rosterId}`;
            return (
              <tr key={player.playerId} className="border-t border-stone-100 first:border-t-0 bg-amber-50/40">
                <td className="px-2 py-2">
                  <RoleBadges roleCodes={player.roleCodes} />
                </td>
                <td className="px-2 py-2 text-sm font-semibold text-stone-800 whitespace-nowrap">
                  {player.playerName}
                  <form id={formId} action={updateRosterPlayerAction.bind(null, player.rosterId)} />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    form={formId}
                    name="realTeam"
                    defaultValue={player.realTeam ?? ''}
                    className="w-full min-w-0 rounded border border-stone-300 text-xs px-1.5 py-1"
                  />
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1 justify-end sm:justify-center">
                    <input
                      type="number"
                      step="0.5"
                      form={formId}
                      name="cost"
                      defaultValue={player.cost ?? ''}
                      className="w-14 rounded border border-stone-300 text-xs px-1.5 py-1 text-center tabular-nums"
                    />
                    <SaveButton
                      formId={formId}
                      resetKey={JSON.stringify({ realTeam: player.realTeam, cost: player.cost })}
                      pendingLabel="Salvo…"
                      className="rounded bg-brand-400 text-brand-950 text-xs font-semibold px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Salva
                    </SaveButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
