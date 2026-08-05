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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

// Ricalca SeasonHero: stesso wrapper m-4/gradiente, testo/select/CTA
// sostituiti da blocchi pulsanti di dimensione equivalente.
export function SeasonHeroSkeleton() {
  return (
    <div className="m-4 animate-pulse rounded-2xl bg-brand-900/40 p-5">
      <div className="mb-2 h-3 w-28 rounded bg-white/20" />
      <div className="mb-4 h-6 w-56 rounded bg-white/20" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="h-10 w-full rounded-lg bg-white/20 sm:w-56" />
        <div className="h-10 w-28 rounded-lg bg-white/20" />
      </div>
    </div>
  );
}

// Ricalca TeamQuickPanel: solo lo scheletro leggero (crest+nome + 2 card),
// niente più le 5 card pesanti di TeamPanelSkeleton (che resta per
// /profilo-squadra).
export function TeamQuickPanelSkeleton() {
  return (
    <div className="border-b border-stone-200 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-stone-200" />
        <div className="h-5 w-40 animate-pulse rounded bg-stone-200" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="mb-2 h-3 w-20 animate-pulse rounded bg-stone-200" />
            <div className="mb-2 h-7 w-16 animate-pulse rounded bg-stone-200" />
            <div className="h-3 w-full animate-pulse rounded bg-stone-200" />
          </div>
        ))}
      </div>
    </div>
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
