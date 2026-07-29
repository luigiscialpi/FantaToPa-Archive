// Skeleton del calendario: ricalca la struttura di MatchdayGroup (header
// giornata + 3 righe match con crests circolari e punteggio) per 3 giornate.
export default function CalendarioLoading() {
  return (
    <main>
      <div className="p-4">
        {/* Titolo stagione + competizione */}
        <div className="h-6 w-40 bg-stone-200 rounded animate-pulse mb-1" />
        <div className="h-4 w-28 bg-stone-200 rounded animate-pulse mb-4" />

        {/* 3 gruppi giornata */}
        {Array.from({ length: 3 }).map((_, gi) => (
          <div key={gi} className="mb-4 rounded-xl bg-white border border-stone-200 overflow-hidden">
            {/* Header giornata */}
            <div className="px-4 py-2 bg-stone-100">
              <div className="h-3 w-24 bg-stone-200 rounded animate-pulse" />
            </div>
            {/* 3 match rows */}
            <div className="divide-y divide-stone-100">
              {Array.from({ length: 3 }).map((_, mi) => (
                <div key={mi} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 flex items-center gap-2">
                    <div className="w-6 h-6 bg-stone-200 rounded-full animate-pulse shrink-0" />
                    <div
                      className="h-4 bg-stone-200 rounded animate-pulse"
                      style={{ width: `${90 + (mi % 3) * 20}px` }}
                    />
                  </div>
                  <div className="shrink-0 px-2">
                    <div className="h-5 w-14 bg-stone-200 rounded animate-pulse" />
                  </div>
                  <div className="flex-1 flex items-center gap-2 justify-end">
                    <div
                      className="h-4 bg-stone-200 rounded animate-pulse"
                      style={{ width: `${80 + (mi % 2) * 30}px` }}
                    />
                    <div className="w-6 h-6 bg-stone-200 rounded-full animate-pulse shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
