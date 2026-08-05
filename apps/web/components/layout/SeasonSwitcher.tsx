// apps/web/components/layout/SeasonSwitcher.tsx
//
// Vive nell'header globale (AppHeader), non nel layout di stagione: deriva
// la stagione attiva da usePathname() invece di riceverla come prop, perché
// l'header è renderizzato anche fuori da /stagioni/[season]/** (es. Home) e
// da lì non arriverebbe alcuno slug. Fuori da una pagina di stagione il
// cambio porta a /stagioni/<slug>/classifica (pagina di atterraggio di
// default); dentro una pagina di stagione sostituisce solo lo slug,
// mantenendo il resto del percorso, come prima.
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { isTopLevelRoute } from '../../lib/navigation/top-level-routes';
import type { SeasonOption } from '../../lib/queries/seasons';

type SeasonSwitcherProps = {
  seasons: SeasonOption[];
  // 'compact': affiancato a GlobalNav nella stessa riga (mobile) — larghezza
  // limitata e testo troncato, la label completa resta comunque nel menu
  // aperto. 'full' (default): riga propria o affiancato ad AccountActions su
  // desktop, dove lo spazio non manca.
  variant?: 'full' | 'compact';
};

export function SeasonSwitcher({ seasons, variant = 'full' }: SeasonSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Nelle pagine top-level (Home, Albo d'Oro, Statistiche, Profilo Squadra)
  // non c'è una stagione attiva da mostrare/cambiare: il selettore non ha
  // senso lì, su nessun breakpoint.
  if (isTopLevelRoute(pathname)) {
    return null;
  }

  // Stagioni con solo un podio manuale (nessuna giornata reale) non hanno
  // pagine di dominio da mostrare: fuori dal selettore, non solo "disabled".
  const browsableSeasons = seasons.filter((season) => season.hasSchedule);

  if (browsableSeasons.length <= 1) {
    return null;
  }

  const seasonMatch = /^\/stagioni\/([^/]+)/.exec(pathname);
  const activeSeasonSlug = seasonMatch ? seasonMatch[1] : '';

  function handleChange(nextSlug: string) {
    if (!nextSlug) return;
    const nextPath = seasonMatch
      ? pathname.replace(`/stagioni/${activeSeasonSlug}`, `/stagioni/${nextSlug}`)
      : `/stagioni/${nextSlug}/classifica`;
    router.push(nextPath);
  }

  return (
    <div className={variant === 'compact' ? 'relative flex items-center max-w-[42vw] shrink-0' : 'relative flex items-center w-full sm:w-auto'}>
      <select
        value={activeSeasonSlug}
        onChange={(event) => handleChange(event.target.value)}
        aria-label="Stagione"
        className={
          variant === 'compact'
            ? 'appearance-none w-full truncate rounded-md bg-brand-900/40 text-white text-[11px] font-semibold pl-2 pr-6 py-1 border border-brand-100/20 focus:outline-none focus:ring-2 focus:ring-brand-100/40 cursor-pointer'
            : 'appearance-none w-full sm:w-auto rounded-lg bg-stone-100/90 text-brand-950 text-xs font-bold pl-2.5 pr-7 py-1.5 border border-stone-200/90 focus:outline-none focus:ring-2 focus:ring-brand-600/30 cursor-pointer shadow-sm hover:bg-stone-200/90 transition-colors'
        }
      >
        {!seasonMatch && (
          <option value="" disabled>
            Seleziona stagione...
          </option>
        )}
        {browsableSeasons.map((season) => (
          <option key={season.id} value={season.slug}>
            {season.label}
          </option>
        ))}
      </select>
      <div className={`pointer-events-none absolute right-2 flex items-center ${variant === 'compact' ? 'text-white/80' : 'text-brand-700'}`}>
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </div>
    </div>
  );
}
