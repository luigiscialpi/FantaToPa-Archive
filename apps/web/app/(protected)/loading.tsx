// Skeleton della Home: ricalca pannello squadra (5 tessere) + vetrina
// generale (4 tessere) + galleria stagioni, così il passaggio al contenuto
// reale non causa salti di layout (stesso pattern di stagioni/[season]/
// classifica/loading.tsx).
export default function HomeLoading() {
  return (
    <main>
      {/* Pannello squadra personale */}
      <div className="border-b border-stone-200 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-stone-200" />
          <div className="h-5 w-40 animate-pulse rounded bg-stone-200" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="mb-2 h-3 w-20 animate-pulse rounded bg-stone-200" />
              <div className="h-6 w-16 animate-pulse rounded bg-stone-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Vetrina generale */}
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

      {/* Galleria stagioni */}
      <div className="p-4">
        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-stone-200" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
