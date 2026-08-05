// apps/web/app/(protected)/profilo-squadra/loading.tsx
//
// Senza questo file, Next.js userebbe app/(protected)/loading.tsx (lo
// skeleton della Home: SeasonHero + TeamQuickPanel a 2 colonne) come
// fallback per la primissima navigazione qui — struttura tutta diversa
// da questa pagina. Ricalca l'header reale (titolo + selettore squadra)
// più lo stesso TeamPanelSkeleton usato dal <Suspense> interno.
import { TeamPanelSkeleton } from '../../../components/home/HomeSkeletons';

export default function ProfiloSquadraLoading() {
  return (
    <main>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
        <h1 className="font-serif font-bold text-xl text-brand-950">Profilo Squadra</h1>
        <div className="h-9 w-full animate-pulse rounded-lg bg-stone-200 sm:w-56" />
      </div>
      <TeamPanelSkeleton />
    </main>
  );
}
