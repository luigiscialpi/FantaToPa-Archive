// apps/web/components/statistiche/HeadToHeadChart.tsx
//
// Grafico a due linee (punti cumulativi o fantapunti di giornata) per il
// confronto tra due squadre — stesso approccio "SVG puro" di
// StandingSparkline (home/), niente libreria di charting. Client component
// (a differenza dello sparkline) per il tooltip al tap: su mobile non c'è
// hover, quindi il <title> nativo usato altrove non basta.
'use client';

import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { HeadToHeadPoint } from '../../lib/queries/statistiche';

const WIDTH = 600;
const HEIGHT = 240;
const PADDING_LEFT = 34;
const PADDING_RIGHT = 12;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 28;
const Y_TICKS = 4;
// Non più di ~6 etichette in ascissa: con 38 giornate una per giornata
// sarebbe illeggibile, si passa a un'etichetta ogni N giornate.
const MAX_X_LABELS = 6;

type Series = { label: string; colorClass: string; dotClass: string; values: (number | null)[] };

function niceStep(rawStep: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rawStep || 1));
  const normalized = rawStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

export function HeadToHeadChart({
  points,
  team1Label,
  team2Label,
  statType,
}: {
  points: HeadToHeadPoint[];
  team1Label: string;
  team2Label: string;
  statType: 'punti' | 'fantapunti';
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return <p className="text-sm text-stone-500">Nessuna giornata disponibile per questa competizione.</p>;
  }

  const series: Series[] = [
    {
      label: team1Label,
      colorClass: 'stroke-amber-500',
      dotClass: 'fill-amber-500',
      values: points.map((point) => (statType === 'punti' ? point.team1Points : point.team1Fantapoints)),
    },
    {
      label: team2Label,
      colorClass: 'stroke-sky-600',
      dotClass: 'fill-sky-600',
      values: points.map((point) => (statType === 'punti' ? point.team2Points : point.team2Fantapoints)),
    },
  ];

  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const allValues = series.flatMap((s) => s.values).filter((value): value is number => value !== null);
  const minValue = allValues.length > 0 ? Math.min(0, ...allValues) : 0;
  const maxValue = allValues.length > 0 ? Math.max(1, ...allValues) : 1;
  const step = niceStep((maxValue - minValue) / Y_TICKS) || 1;
  const axisMin = Math.floor(minValue / step) * step;
  const axisMax = Math.ceil(maxValue / step) * step;
  const range = axisMax - axisMin || 1;

  function xFor(index: number) {
    return PADDING_LEFT + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  }
  function yFor(value: number) {
    return PADDING_TOP + plotHeight - ((value - axisMin) / range) * plotHeight;
  }

  function coordsFor(values: (number | null)[]) {
    return values.map((value, index) => (value === null ? null : { x: xFor(index), y: yFor(value) }));
  }

  // Una linea per ogni tratto continuo di dati (una giornata senza partita,
  // es. turno di riposo, spezza la linea invece di saltare dritto al punto
  // successivo come se nulla fosse).
  function segmentsFor(values: (number | null)[]): string[] {
    const coords = coordsFor(values);
    const segments: string[] = [];
    let current: string[] = [];
    for (const coord of coords) {
      if (coord) {
        current.push(`${coord.x},${coord.y}`);
      } else if (current.length > 0) {
        segments.push(current.join(' '));
        current = [];
      }
    }
    if (current.length > 0) segments.push(current.join(' '));
    return segments;
  }

  const yTicks = Array.from({ length: Math.round(range / step) + 1 }, (_, i) => axisMin + i * step);

  const xLabelStride = Math.max(1, Math.ceil(points.length / MAX_X_LABELS));
  const xLabelIndexes = points
    .map((_, index) => index)
    .filter((index) => index % xLabelStride === 0 || index === points.length - 1);

  function nearestIndexForClientX(clientX: number, svg: SVGSVGElement): number {
    const rect = svg.getBoundingClientRect();
    const relativeX = ((clientX - rect.left) / rect.width) * WIDTH;
    let closest = 0;
    let closestDistance = Infinity;
    for (let i = 0; i < points.length; i++) {
      const distance = Math.abs(xFor(i) - relativeX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = i;
      }
    }
    return closest;
  }

  function handlePointer(e: ReactPointerEvent<SVGSVGElement>) {
    setActiveIndex(nearestIndexForClientX(e.clientX, e.currentTarget));
  }

  const active = activeIndex !== null ? points[activeIndex] : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full overflow-visible touch-none cursor-pointer"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        onPointerDown={handlePointer}
        onPointerMove={(e) => e.buttons === 1 && handlePointer(e)}
      >
        {/* Griglia + etichette ordinate: senza, i valori dell'asse Y restano
            impliciti nell'altezza delle linee, non leggibili a colpo d'occhio. */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING_LEFT}
              x2={WIDTH - PADDING_RIGHT}
              y1={yFor(tick)}
              y2={yFor(tick)}
              className="stroke-stone-200"
              strokeWidth="1"
            />
            <text x={PADDING_LEFT - 6} y={yFor(tick)} textAnchor="end" dominantBaseline="middle" className="fill-stone-400 text-[9px]">
              {tick}
            </text>
          </g>
        ))}

        {/* Etichette ascisse: numero di giornata, non tutte per non affollare. */}
        {xLabelIndexes.map((index) => (
          <text
            key={index}
            x={xFor(index)}
            y={HEIGHT - PADDING_BOTTOM + 14}
            textAnchor="middle"
            className="fill-stone-400 text-[9px]"
          >
            {points[index]!.matchdayNumber}ª
          </text>
        ))}

        {series.map((s) =>
          segmentsFor(s.values).map((segment, i) => (
            <polyline
              key={`${s.label}-${i}`}
              points={segment}
              fill="none"
              className={s.colorClass}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )),
        )}

        {active && (
          <line
            x1={xFor(activeIndex!)}
            x2={xFor(activeIndex!)}
            y1={PADDING_TOP}
            y2={HEIGHT - PADDING_BOTTOM}
            className="stroke-stone-300"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {active &&
          series.map((s, seriesIndex) => {
            const value =
              statType === 'punti'
                ? seriesIndex === 0
                  ? active.team1Points
                  : active.team2Points
                : seriesIndex === 0
                  ? active.team1Fantapoints
                  : active.team2Fantapoints;
            if (value === null) return null;
            return <circle key={s.label} cx={xFor(activeIndex!)} cy={yFor(value)} r="3.5" className={s.dotClass} />;
          })}
      </svg>

      {active && (
        <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
          <div className="mb-1 font-semibold text-stone-700">{active.matchdayNumber}ª giornata</div>
          <div className="flex items-center gap-1.5 text-stone-600">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            {team1Label}: <strong>{(statType === 'punti' ? active.team1Points : active.team1Fantapoints) ?? '—'}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-stone-600">
            <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0" />
            {team2Label}: <strong>{(statType === 'punti' ? active.team2Points : active.team2Fantapoints) ?? '—'}</strong>
          </div>
        </div>
      )}

      <div className="mt-3 flex justify-center gap-4">
        <span className="flex items-center gap-1.5 text-xs text-stone-600">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          {team1Label}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-stone-600">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
          {team2Label}
        </span>
      </div>
    </div>
  );
}
