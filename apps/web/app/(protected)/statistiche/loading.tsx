// apps/web/app/(protected)/statistiche/loading.tsx
//
// Skeleton coerente con la struttura reale (controlli + grafico), stesso
// principio di albo-doro/loading.tsx.
export default function StatisticheLoading() {
  return (
    <main className="p-4">
      <div className="mb-1 h-6 w-32 animate-pulse rounded bg-stone-200" />
      <div className="mb-4 h-4 w-72 animate-pulse rounded bg-stone-200" />
      <div className="space-y-2 mb-4">
        <div className="flex gap-2">
          <div className="h-8 flex-1 animate-pulse rounded-lg bg-stone-200" />
          <div className="h-8 flex-1 animate-pulse rounded-lg bg-stone-200" />
        </div>
        <div className="h-8 w-full animate-pulse rounded-lg bg-stone-200" />
        <div className="h-8 w-full animate-pulse rounded-lg bg-stone-200" />
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="h-56 animate-pulse rounded bg-stone-100" />
      </div>
    </main>
  );
}
