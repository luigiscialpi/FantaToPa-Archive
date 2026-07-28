// apps/web/components/classifica/ClassificaRow.tsx
import { Crest } from '../shared/Crest';
import type { StandingsRow } from '../../lib/queries/classifica';

const MEDAL_STYLES = [
  'bg-amber-100 text-amber-800 ring-amber-500',
  'bg-stone-200 text-stone-700 ring-stone-400',
  'bg-orange-100 text-orange-900 ring-orange-700',
];

function StatCell({ value }: { value: number | null }) {
  return <td className="px-2 py-2 text-center tabular-nums text-stone-600">{value ?? '–'}</td>;
}

export function ClassificaRow({ row }: { row: StandingsRow }) {
  const medal = row.position !== null && row.position <= 3 ? MEDAL_STYLES[row.position - 1] : null;
  const goalDiffLabel = row.goalDiff !== null ? `${row.goalDiff > 0 ? '+' : ''}${row.goalDiff}` : '–';

  return (
    <tr className="border-t border-stone-100 first:border-t-0">
      <td className="px-2 py-2">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center font-serif font-bold text-sm tabular-nums ${
            medal ? `${medal} ring-2` : 'text-stone-400'
          }`}
        >
          {row.position ?? '–'}
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Crest name={row.teamName} />
          <span className="text-sm font-semibold text-stone-800">{row.teamName}</span>
        </div>
      </td>
      <StatCell value={row.played} />
      <StatCell value={row.won} />
      <StatCell value={row.drawn} />
      <StatCell value={row.lost} />
      <StatCell value={row.goalsFor} />
      <StatCell value={row.goalsAgainst} />
      <td className="px-2 py-2 text-center tabular-nums text-stone-600">{goalDiffLabel}</td>
      <td className="px-2 py-2 text-center font-serif font-bold text-emerald-800 tabular-nums">
        {row.points ?? '–'}
      </td>
      <td className="px-2 py-2 text-center text-stone-500 tabular-nums">{row.totalFantapoints ?? '–'}</td>
    </tr>
  );
}

