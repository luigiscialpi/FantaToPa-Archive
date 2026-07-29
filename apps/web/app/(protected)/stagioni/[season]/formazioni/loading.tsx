// Skeleton delle formazioni: ricalca la struttura di MatchdaySelector +
// MatchCard (header partita stile brand-600 + area formazione espansa per
// la prima card, collassate per le altre).
export default function FormazioniLoading() {
  return (
    <main>
      <div className="p-4">
        {/* Titolo stagione + competizione */}
        <div className="h-6 w-40 bg-stone-200 rounded animate-pulse mb-1" />
        <div className="h-4 w-28 bg-stone-200 rounded animate-pulse mb-4" />

        {/* Selettore giornata (MatchdaySelector) */}
        <div className="mb-4">
          <div className="h-10 w-48 bg-stone-100 rounded-lg animate-pulse" />
        </div>

        {/* 3 match cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-4 rounded-xl bg-white border border-stone-200 overflow-hidden">
            {/* Header partita (bg brand-600) */}
            <div className="bg-brand-600 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-500 rounded-full animate-pulse shrink-0" />
              <div className="flex-1">
                <div className="h-3 w-24 bg-brand-500 rounded animate-pulse" />
              </div>
              <div className="h-5 w-14 bg-amber-300/30 rounded animate-pulse shrink-0 mx-2" />
              <div className="flex-1 flex justify-end">
                <div className="h-3 w-24 bg-brand-500 rounded animate-pulse" />
              </div>
              <div className="w-8 h-8 bg-brand-500 rounded-full animate-pulse shrink-0" />
            </div>

            {/* Formazione espansa solo per la prima card */}
            {i === 0 && (
              <div className="px-4 py-3 flex flex-row gap-3">
                {/* Colonna casa */}
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 bg-stone-200 rounded animate-pulse mb-3" />
                  {Array.from({ length: 8 }).map((_, j) => (
                    <div key={j} className="flex items-center justify-between">
                      <div className="h-3 bg-stone-200 rounded animate-pulse" style={{ width: `${70 + (j % 3) * 15}px` }} />
                      <div className="h-3 w-8 bg-stone-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="w-px bg-stone-200 shrink-0" />
                {/* Colonna trasferta */}
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 bg-stone-200 rounded animate-pulse mb-3" />
                  {Array.from({ length: 8 }).map((_, j) => (
                    <div key={j} className="flex items-center justify-between">
                      <div className="h-3 bg-stone-200 rounded animate-pulse" style={{ width: `${65 + (j % 3) * 18}px` }} />
                      <div className="h-3 w-8 bg-stone-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
