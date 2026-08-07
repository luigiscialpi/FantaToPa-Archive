// apps/web/components/classifica/ClassificaRow.tsx
import Link from 'next/link';
import { Crest } from '../shared/Crest';
import { SaveButton } from '../shared/SaveButton';
import { updateStandingsRowAction } from '../../lib/admin/classifica-actions';
import type { StandingsRow } from '../../lib/queries/classifica';

const MEDAL_STYLES = [
  'bg-amber-100 text-amber-800 ring-amber-500',
  'bg-stone-200 text-stone-700 ring-stone-400',
  'bg-orange-100 text-orange-900 ring-orange-700',
];

function StatCell({ value }: { value: number | null }) {
  return <td className="px-2 py-2 text-center tabular-nums text-stone-600">{value ?? '–'}</td>;
}

// Colonne numeriche sparse su più <td> di una stessa <tr>: un <form> non
// può avvolgere delle <td> sole (serve dentro una <tr>/<table>), quindi gli
// input usano l'attributo HTML `form` per associarsi a un <form> vuoto
// piazzato nella prima cella, invece di annidare il form nel markup.
function EditableCell({ formId, name, defaultValue, step }: { formId: string; name: string; defaultValue: number | null; step?: string }) {
  return (
    <td className="px-1 py-1 text-center">
      <input
        type="number"
        step={step ?? '1'}
        name={name}
        form={formId}
        defaultValue={defaultValue ?? ''}
        className="w-12 rounded border border-stone-300 text-xs px-1 py-1 text-center tabular-nums"
      />
    </td>
  );
}

export function ClassificaRow({
  row,
  seasonSlug,
  editMode = false,
}: {
  row: StandingsRow;
  seasonSlug: string;
  editMode?: boolean;
}) {
  const medal = row.position !== null && row.position <= 3 ? MEDAL_STYLES[row.position - 1] : null;
  const goalDiffLabel = row.goalDiff !== null ? `${row.goalDiff > 0 ? '+' : ''}${row.goalDiff}` : '–';

  // row.id è null per la vista calcolata al volo (getStandingsForRange, filtro
  // per giornate): niente riga scrivibile da aggiornare, si ricade sulla resa
  // di sola lettura anche se editMode è attivo.
  if (editMode && row.id !== null) {
    const formId = `classifica-row-${row.id}`;
    return (
      <tr className="border-t border-stone-100 first:border-t-0 bg-amber-50/40">
        <td className="px-1 py-1">
          <form id={formId} action={updateStandingsRowAction.bind(null, row.id)} />
          <input
            type="number"
            name="position"
            form={formId}
            defaultValue={row.position ?? ''}
            className="w-10 rounded border border-stone-300 text-xs px-1 py-1 text-center tabular-nums"
          />
        </td>
        <td className="px-2 py-1">
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Crest name={row.teamName} imageUrl={row.jerseyUrl} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-stone-800">{row.teamName}</span>
              {row.managerName && <span className="block text-[11px] text-stone-400">{row.managerName}</span>}
            </span>
          </span>
        </td>
        <EditableCell formId={formId} name="played" defaultValue={row.played} />
        <EditableCell formId={formId} name="won" defaultValue={row.won} />
        <EditableCell formId={formId} name="drawn" defaultValue={row.drawn} />
        <EditableCell formId={formId} name="lost" defaultValue={row.lost} />
        <EditableCell formId={formId} name="goalsFor" defaultValue={row.goalsFor} />
        <EditableCell formId={formId} name="goalsAgainst" defaultValue={row.goalsAgainst} />
        <td className="px-2 py-1 text-center tabular-nums text-stone-400" title="Ricalcolata da Gf/Gs al salvataggio">
          {goalDiffLabel}
        </td>
        <EditableCell formId={formId} name="points" defaultValue={row.points} />
        <EditableCell formId={formId} name="totalFantapoints" defaultValue={row.totalFantapoints} step="0.5" />
        <td className="px-1 py-1">
          <SaveButton
            formId={formId}
            resetKey={JSON.stringify(row)}
            pendingLabel="Salvo…"
            className="rounded bg-brand-400 text-brand-950 text-xs font-semibold px-2 py-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Salva
          </SaveButton>
        </td>
      </tr>
    );
  }

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
        <Link
          href={`/stagioni/${seasonSlug}/rose#squadra-${row.teamSlug}`}
          className="flex items-center gap-2 whitespace-nowrap hover:text-brand-700"
        >
          <Crest name={row.teamName} imageUrl={row.jerseyUrl} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-stone-800">{row.teamName}</span>
            {row.managerName && <span className="block text-[11px] text-stone-400">{row.managerName}</span>}
          </span>
        </Link>
      </td>
      <StatCell value={row.played} />
      <StatCell value={row.won} />
      <StatCell value={row.drawn} />
      <StatCell value={row.lost} />
      <StatCell value={row.goalsFor} />
      <StatCell value={row.goalsAgainst} />
      <td className="px-2 py-2 text-center tabular-nums text-stone-600">{goalDiffLabel}</td>
      <td className="px-2 py-2 text-center font-serif font-bold text-brand-800 tabular-nums">
        {row.points ?? '–'}
      </td>
      <td className="px-2 py-2 text-center text-stone-500 tabular-nums">{row.totalFantapoints ?? '–'}</td>
    </tr>
  );
}

