// apps/web/components/home/StandingSparkline.tsx
//
// Sparkline SVG dell'andamento del piazzamento in campionato, stagione per
// stagione. Server Component puro: il dato è statico per la request, niente
// hover/JS necessario. Il <title> annidato in ogni <circle> dà un tooltip
// nativo del browser al passaggio del mouse, gratis (desktop soltanto — su
// touch non c'è hover, ma il piazzamento corrente resta comunque leggibile
// nel numero grande sopra lo sparkline).
//
// ponytail: la scala verticale usa il min/max osservato nella storia DI
// QUESTA squadra, non il numero di squadre in classifica quella stagione —
// un 2° posto su 6 squadre e un 2° posto su 20 appaiono alla stessa altezza.
// Corretto per mostrare "come sta andando questa squadra nel tempo", non per
// confrontare campionati di dimensioni diverse fra loro.
import type { StandingHistoryPoint } from '../../lib/queries/home';

const WIDTH = 160;
const HEIGHT = 44;
const PADDING = 5;

export function StandingSparkline({ history }: { history: StandingHistoryPoint[] }) {
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
          return (
            <circle
              key={point.seasonSlug}
              cx={x}
              cy={y}
              r={isLast ? 2.75 : 2}
              strokeWidth="1.25"
              className={isLast ? 'fill-brand-600 stroke-brand-600' : 'fill-white stroke-brand-400'}
            >
              <title>{`${point.seasonLabel}: ${point.position}°`}</title>
            </circle>
          );
        })}
      </svg>
      {firstSeason && lastSeason && (
        <div className="flex justify-between text-[10px] text-stone-400">
          <span>{firstSeason.seasonSlug}</span>
          <span>{lastSeason.seasonSlug}</span>
        </div>
      )}
    </div>
  );
}
