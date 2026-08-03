// apps/web/components/home/SeasonGallery.tsx
//
// Galleria stagioni (piano, sezione 10, punto 3): ingresso per navigare le
// annate dalla Home, distinto dal selettore persistente in header (quello
// serve a cambiare stagione restando sulla stessa vista dentro
// stagioni/[season]/).
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { Crest } from '../shared/Crest';
import type { GalleryTeam, SeasonGalleryEntry } from '../../lib/queries/home';

// Ordine di visualizzazione 2°, 1°, 3° con altezze a gradoni e colori alle
// medaglie (oro/argento/bronzo, come nel mockup PodiumBlock). Le altezze sono
// puramente estetiche: non ci sono dati per variare la lunghezza delle barre.
const PODIUM_TIERS = [
  { pos: 2, height: 'h-8', bar: 'bg-stone-300', ring: 'ring-stone-400', text: 'text-stone-700' },
  { pos: 1, height: 'h-10', bar: 'bg-amber-400', ring: 'ring-amber-500', text: 'text-amber-950' },
  { pos: 3, height: 'h-6', bar: 'bg-orange-300', ring: 'ring-orange-600', text: 'text-orange-900' },
] as const;

// Podio compatto della giornata (piano, sezione 10, punto 3): 1° al centro
// più alto, 2° a sinistra, 3° a destra. Riproduce il layout del mockup, ma con
// le maglie/loghi reali del team_seasons quando disponibili.
function SeasonPodium({ podium }: { podium: GalleryTeam[] }) {
  const teamsByPosition = podium.reduce(
    (acc, team, index) => {
      acc[index + 1] = team;
      return acc;
    },
    {} as Record<number, GalleryTeam>,
  );

  return (
    <div className="flex items-end mt-3 justify-center gap-1.5">
      {PODIUM_TIERS.map((tier) => {
        const team = teamsByPosition[tier.pos];
        return (
          <div key={team ? team.teamId : tier.pos} className="flex flex-col items-center flex-1 min-w-0">
            {team ? (
              <>
                <Crest name={team.name} imageUrl={team.logoUrl} highlight={team.isUserTeam} />
                <span
                  className="mt-0.5 max-w-full truncate text-center text-[10px] font-medium text-stone-600 leading-tight"
                  title={team.name}
                >
                  {team.name}
                </span>
              </>
            ) : (
              <div className="w-9 h-9" />
            )}
            <div
              className={`mt-0.5 w-full rounded-t-lg ring-2 ${tier.bar} ${tier.ring} flex items-start justify-center ${tier.height} pt-0.5`}
            >
              <span className={`font-serif font-bold text-xs leading-none ${tier.text}`}>{tier.pos}°</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Vincitore Coppa: etichetta ed emblema/nome su righe separate (non solo su
// mobile: sulla stessa riga il nome aveva pochissimo spazio residuo dopo
// l'etichetta e uno spigolo diventava invisibile invece di troncare — vedi
// screenshot vista mobile, card "Le stagioni" a 2 colonne).
function CupWinnerLine({ winner }: { winner: GalleryTeam }) {
  return (
    <div className="mt-1.5 flex flex-col items-center gap-1">
      <span className="flex items-center mt-3 mb-2 gap-1 text-[10px] uppercase tracking-wide text-stone-500">
        <Trophy size={12} className="shrink-0 text-amber-600" />
        Vincitore Coppa
      </span>
      {/* w-full: senza, in flex-col la riga si dimensia sul contenuto e
          min-w-0 sullo span non ha nessun limite reale da cui troncare. */}
      <div className="flex w-full items-center justify-center gap-1.5">
        <Crest name={winner.name} imageUrl={winner.logoUrl} highlight={winner.isUserTeam} />
        <span className="min-w-0 truncate text-xs font-medium text-stone-800" title={winner.name}>
          {winner.name}
        </span>
      </div>
    </div>
  );
}

export function SeasonGallery({ seasons }: { seasons: SeasonGalleryEntry[] }) {
  if (seasons.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Le stagioni</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {seasons.map((season) => {
          const cardContent = (
            <>
              <div className="font-serif font-bold text-stone-800">{season.label}</div>
              {season.inProgress ? (
                <div className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  In corso
                </div>
              ) : season.podium ? (
                <div className="mt-2">
                  <SeasonPodium podium={season.podium} />
                  {season.cupWinner && <CupWinnerLine winner={season.cupWinner} />}
                </div>
              ) : null}
            </>
          );

          // Stagioni con solo un podio manuale (nessuna giornata reale, es.
          // 2004-05→2012-13): il podio/vincitore coppa resta visibile (utile
          // per le statistiche), ma niente Link — classifica/calendario/
          // formazioni sarebbero vuoti, click disabilitato invece di portare
          // a una pagina senza contenuto.
          if (!season.hasSchedule) {
            return (
              <div
                key={season.id}
                aria-disabled="true"
                className="rounded-xl border border-stone-200 bg-stone-50 p-4 opacity-60 cursor-not-allowed"
              >
                {cardContent}
              </div>
            );
          }

          return (
            <Link
              key={season.id}
              href={`/stagioni/${season.slug}/classifica`}
              className="rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-brand-400"
            >
              {cardContent}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
