// apps/web/components/classifica/ClassificaTable.tsx
'use client';

import { useMemo, useState } from 'react';
import { ClassificaRow } from './ClassificaRow';
import type { StandingsRow } from '../../lib/queries/classifica';

// Solo campi numerici nullable presenti su StandingsRow: intestazioni
// cliccabili come nello screenshot di riferimento, tabella reale invece del
// riepilogo su una riga — l'orizzontale scroll (overflow-x-auto sul
// contenitore) copre gli schermi stretti invece di rinunciare alle colonne.
type SortKey = 'position' | 'played' | 'won' | 'drawn' | 'lost' | 'goalsFor' | 'goalsAgainst' | 'goalDiff' | 'points' | 'totalFantapoints';

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: 'played', label: 'G', title: 'Giocate' },
  { key: 'won', label: 'V', title: 'Vinte' },
  { key: 'drawn', label: 'N', title: 'Nulle (pareggi)' },
  { key: 'lost', label: 'P', title: 'Perse' },
  { key: 'goalsFor', label: 'Gf', title: 'Gol fatti' },
  { key: 'goalsAgainst', label: 'Gs', title: 'Gol subiti' },
  { key: 'goalDiff', label: 'Dr', title: 'Differenza reti' },
  { key: 'points', label: 'Pt', title: 'Punti' },
  { key: 'totalFantapoints', label: 'Pt Totali', title: 'Fantapunti totali' },
];

export function ClassificaTable({
  rows,
  seasonSlug,
  editMode = false,
}: {
  rows: StandingsRow[];
  seasonSlug: string;
  editMode?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('position');
  const [ascending, setAscending] = useState(true);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const valueA = a[sortKey] ?? -Infinity;
      const valueB = b[sortKey] ?? -Infinity;
      return ascending ? valueA - valueB : valueB - valueA;
    });
    return copy;
  }, [rows, sortKey, ascending]);

  function selectSort(key: SortKey) {
    if (key === sortKey) {
      setAscending((prev) => !prev);
    } else {
      setSortKey(key);
      setAscending(key === 'position');
    }
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 px-4 py-8 text-center text-sm text-stone-500">
        Nessuna classifica disponibile per questa competizione.
      </div>
    );
  }

  function SortArrow({ active }: { active: boolean }) {
    if (!active) return null;
    return <span className="ml-0.5">{ascending ? '↑' : '↓'}</span>;
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
            <th
              scope="col"
              className="px-2 py-2 text-left font-semibold cursor-pointer select-none whitespace-nowrap"
              onClick={() => selectSort('position')}
            >
              #<SortArrow active={sortKey === 'position'} />
            </th>
            <th scope="col" className="px-2 py-2 text-left font-semibold whitespace-nowrap">
              Squadra
            </th>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                title={column.title}
                className="px-2 py-2 text-center font-semibold cursor-pointer select-none whitespace-nowrap"
                onClick={() => selectSort(column.key)}
              >
                {column.label}
                <SortArrow active={sortKey === column.key} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <ClassificaRow key={row.teamSlug || row.teamName} row={row} seasonSlug={seasonSlug} editMode={editMode} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

