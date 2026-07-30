// apps/web/components/home/SeasonGallery.tsx
//
// Galleria stagioni (piano, sezione 10, punto 3): ingresso per navigare le
// annate dalla Home, distinto dal selettore persistente in header (quello
// serve a cambiare stagione restando sulla stessa vista dentro
// stagioni/[season]/).
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import type { SeasonGalleryEntry } from '../../lib/queries/home';

export function SeasonGallery({ seasons }: { seasons: SeasonGalleryEntry[] }) {
  if (seasons.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Le stagioni</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {seasons.map((season) => (
          <Link
            key={season.id}
            href={`/stagioni/${season.slug}/classifica`}
            className="rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-brand-400"
          >
            <div className="font-serif font-bold text-stone-800">{season.label}</div>
            {season.inProgress ? (
              <div className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                In corso
              </div>
            ) : season.championName ? (
              <div className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                <Trophy size={12} className="shrink-0 text-amber-500" />
                <span className="truncate">{season.championName}</span>
              </div>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
