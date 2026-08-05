// apps/web/components/home/StandingSparkline.tsx
//
// Sparkline SVG dell'andamento del piazzamento in campionato, stagione per
// stagione.
//
// Client Component (non più Server puro): la card che lo contiene (vedi
// TeamPanel/TeamQuickPanel, "Ultima stagione") è tutta avvolta in un <Link>
// verso la classifica — un tap su un punto del grafico, su touch, altrimenti
// seguirebbe subito il link invece di mostrare il dettaglio di quel punto
// (il <title> nativo è un tooltip solo hover, quindi inutile su mobile).
// preventDefault() nel click handler del punto blocca la navigazione
// dell'anchor SOLO per quel tap; il resto della card resta cliccabile.
//
// ponytail: la scala verticale usa il min/max osservato nella storia DI
// QUESTA squadra, non il numero di squadre in classifica quella stagione —
// un 2° posto su 6 squadre e un 2° posto su 20 appaiono alla stessa altezza.
// Corretto per mostrare "come sta andando questa squadra nel tempo", non per
// confrontare campionati di dimensioni diverse fra loro.
'use client';

import { useState } from 'react';
import type { StandingHistoryPoint } from '../../lib/queries/home';

const WIDTH = 160;
const HEIGHT = 44;
const PADDING = 5;

export function StandingSparkline({ history }: { history: StandingHistoryPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (history.length < 2) {
    return null;
  }

  const positions = history.map((point) => point.position);
  const minPosition = Math.min(...positions);
  const maxPosition = Math.max(...positions);
  const range = maxPosition - minPosition || 1;

  const coords = history.map((point, index) => {
    const x = PADDING + (index / (history.length - 1)) * (WIDTH - 2 * PADDING);
    const y = PADDING + ((point.position - minPosition) / range) * (HEIGHT - 2 * PADDING);
    return { x, y, point };
  });

  const linePoints = coords.map(({ x, y }) => `${x},${y}`).join(' ');
  const firstSeason = history[0];
  const lastSeason = history[history.length - 1];
  const activePoint = activeIndex !== null ? history[activeIndex] : null;

  function handlePointClick(event: React.MouseEvent, index: number) {
    event.preventDefault();
    event.stopPropagation();
    setActiveIndex((current) => (current === index ? null : index));
  }

  return (
    <div className="mt-2.5">
      {/* aspect-ratio = WIDTH/HEIGHT: l'altezza segue la larghezza (piena, w-full)
          invece di restare fissa, così il disegno scala senza mai stirarsi. */}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full overflow-visible"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      >
        <polyline
          points={linePoints}
          fill="none"
          className="stroke-brand-400"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map(({ x, y, point }, index) => {
          const isLast = index === coords.length - 1;
          const isActive = index === activeIndex;
          return (
            <g key={point.seasonSlug} onClick={(event) => handlePointClick(event, index)} className="cursor-pointer">
              {/* area di tap più ampia del pallino visibile (r=2/2.75), invisibile */}
              <circle cx={x} cy={y} r={8} fill="transparent" />
              <circle
                cx={x}
                cy={y}
                r={isActive ? 3.5 : isLast ? 2.75 : 2}
                strokeWidth="1.25"
                className={isActive || isLast ? 'fill-brand-600 stroke-brand-600' : 'fill-white stroke-brand-400'}
              >
                <title>{`${point.seasonLabel}: ${point.position}°`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-stone-400">
        {activePoint ? (
          <span className="font-semibold text-brand-700">
            {activePoint.seasonLabel}: {activePoint.position}°
          </span>
        ) : (
          firstSeason &&
          lastSeason && (
            <>
              <span>{firstSeason.seasonSlug}</span>
              <span>{lastSeason.seasonSlug}</span>
            </>
          )
        )}
      </div>
    </div>
  );
}
