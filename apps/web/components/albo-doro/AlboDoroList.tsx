// apps/web/components/albo-doro/AlboDoroList.tsx
//
// Albo d'Oro (piano, sezione 10): a differenza di Classifica/Formazioni/
// Statistiche non seleziona prima una stagione — mostra TUTTE le annate
// insieme. Riusa SeasonPodium/CupWinnerLine dalla galleria stagioni della
// Home (stesso layout podio 1°-centro/2°-sinistra/3°-destra + vincitore
// Coppa), qui disposti in una griglia di card (stesso aspetto della
// galleria che era in homepage).
import Link from 'next/link';
import type { SeasonGalleryEntry } from '../../lib/queries/home';
import { SeasonPodium, CupWinnerLine } from '../home/SeasonGallery';

export function AlboDoroList({ seasons }: { seasons: SeasonGalleryEntry[] }) {
  if (seasons.length === 0) {
    return <p className="text-sm text-stone-500">Nessuna stagione ancora importata.</p>;
  }

  return (
    <section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              ) : (
                <div className="mt-3 py-3 text-center text-xs italic text-stone-400">
                  Dati non disponibili
                </div>
              )}
            </>
          );

          // Stesso trattamento di SeasonGallery (Home): stagioni con solo un
          // podio manuale (nessuna giornata reale) non hanno click verso
          // classifica/calendario/formazioni, sarebbero vuote.
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

