// apps/web/components/albo-doro/AlboDoroList.tsx
//
// Albo d'Oro (piano, sezione 10): a differenza di Classifica/Formazioni/
// Statistiche non seleziona prima una stagione — mostra TUTTE le annate
// insieme in un'unica lista scorrevole, coerente con cosa è davvero un albo
// d'oro (un registro storico). Riusa SeasonPodium/CupWinnerLine dalla
// galleria stagioni della Home (stesso layout podio 1°-centro/2°-sinistra/
// 3°-destra + vincitore Coppa), qui impilati verticalmente invece che in
// una griglia di card cliccabili.
import { Medal } from 'lucide-react';
import type { SeasonGalleryEntry } from '../../lib/queries/home';
import { SeasonPodium, CupWinnerLine } from '../home/SeasonGallery';

export function AlboDoroList({ seasons }: { seasons: SeasonGalleryEntry[] }) {
  if (seasons.length === 0) {
    return <p className="text-sm text-stone-500">Nessuna stagione ancora importata.</p>;
  }

  return (
    <div className="space-y-4">
      {seasons.map((season) => (
        <div key={season.id} className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Medal size={15} className="shrink-0 text-amber-600" />
            <span className="font-serif font-bold text-brand-950">{season.label}</span>
          </div>

          {season.inProgress ? (
            <div className="rounded-lg bg-emerald-50 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Stagione in corso
            </div>
          ) : season.podium ? (
            <>
              <SeasonPodium podium={season.podium} />
              {season.cupWinner && <CupWinnerLine winner={season.cupWinner} />}
            </>
          ) : (
            <div className="py-3 text-center text-xs italic text-stone-400">Dati non disponibili per questa stagione</div>
          )}
        </div>
      ))}
    </div>
  );
}
