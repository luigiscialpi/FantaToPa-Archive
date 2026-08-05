// apps/web/components/home/SeasonHero.tsx
//
// Hero di ingresso all'archivio storico: prima il selettore stagione viveva
// solo nell'header (piccolo, sempre uguale su ogni pagina) — qui invece è il
// punto di ingresso principale della Home, pensato per invogliare a
// esplorare le stagioni passate (motivo di business del sito: un archivio
// che nessuno sfoglia non ha valore). Scelta esplicita: cambiare stagione
// nella select non naviga subito (a differenza di SeasonSwitcher/
// MatchdaySelector) — qui la selezione è un passo preparatorio a un'azione
// dichiarata ("Esplora"), non un filtro di pagina già montata.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { SeasonOption } from '../../lib/queries/seasons';

type SeasonHeroProps = {
  seasons: SeasonOption[];
};

export function SeasonHero({ seasons }: SeasonHeroProps) {
  const browsableSeasons = seasons.filter((season) => season.hasSchedule);
  const [slug, setSlug] = useState(browsableSeasons[0]?.slug ?? '');

  if (browsableSeasons.length === 0) {
    return null;
  }

  return (
    <div className="m-4 rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 p-5 text-white shadow-lg">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-200/90">Archivio storico</div>
      <h2 className="mb-3 font-serif text-xl font-bold">Esplora una stagione passata</h2>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          aria-label="Scegli la stagione da esplorare"
          className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-300/60 sm:w-auto sm:min-w-56 [&>option]:text-brand-950"
        >
          {browsableSeasons.map((season) => (
            <option key={season.id} value={season.slug}>
              {season.label}
            </option>
          ))}
        </select>
        <Link
          href={`/stagioni/${slug}/classifica`}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-brand-950 shadow transition-colors hover:bg-amber-300"
        >
          Esplora <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
