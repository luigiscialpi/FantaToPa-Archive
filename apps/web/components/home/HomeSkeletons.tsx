// apps/web/components/home/HomeSkeletons.tsx
//
// Skeleton delle sezioni della Home, condivisi da app/(protected)/loading.tsx
// (fallback per la primissima navigazione, prima che HomePage inizi a
// renderizzare) e dai confini <Suspense> dentro page.tsx (fallback
// per-sezione durante lo streaming: ogni sezione mostra il proprio finché
// non è pronta, indipendentemente dalle altre). Un'unica fonte per
// struttura e ordine: prima erano duplicati e l'ordine nello skeleton
// non corrispondeva a quello reale, causando un salto di layout al primo
// swap.

export function TeamPanelSkeleton() {
  return (
    <div className="border-b border-stone-200 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-stone-200" />
        <div className="h-5 w-40 animate-pulse rounded bg-stone-200" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="mb-2 h-3 w-20 animate-pulse rounded bg-stone-200" />
            <div className="mb-2 h-8 w-16 animate-pulse rounded bg-stone-200" />
            <div className="h-16 w-full animate-pulse rounded bg-stone-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Fallback delle 3 card rosa più costose (vedi RosterStatsCards), annidato
// dentro il TeamPanelSkeleton/il pannello già montato — non un confine
// <Suspense> di primo livello come le 2 sezioni sopra.
export function RosterStatsCardsSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="mb-2 h-3 w-20 animate-pulse rounded bg-stone-200" />
          <div className="mb-2 h-7 w-16 animate-pulse rounded bg-stone-200" />
          <div className="h-3 w-full animate-pulse rounded bg-stone-200" />
        </div>
      ))}
    </>
  );
}

export function LeagueShowcaseSkeleton() {
  return (
    <div className="border-b border-stone-200 p-4">
      <div className="mb-2 h-3 w-24 animate-pulse rounded bg-stone-200" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="mb-2 h-3 w-28 animate-pulse rounded bg-stone-200" />
            <div className="mb-1.5 h-4 w-full animate-pulse rounded bg-stone-200" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
