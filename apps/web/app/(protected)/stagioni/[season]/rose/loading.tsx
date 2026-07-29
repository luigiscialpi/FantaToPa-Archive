// Skeleton delle rose: ricalca la struttura di RosterJumpBar (selettore) +
// sezioni squadra con TeamRosterHeader + RosterTable.
export default function RoseLoading() {
  return (
    <main>
      <div className="p-4">
        {/* Titolo stagione + sottotitolo */}
        <div className="h-6 w-40 bg-stone-200 rounded animate-pulse mb-1" />
        <div className="h-4 w-16 bg-stone-200 rounded animate-pulse mb-4" />

        {/* Jump bar (select squadra) */}
        <div className="mb-6">
          <div className="h-10 w-48 bg-stone-100 rounded-lg animate-pulse" />
        </div>

        {/* 2 sezioni squadra */}
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, si) => (
            <div
              key={si}
              className="rounded-xl bg-white border border-stone-200 overflow-hidden"
            >
              {/* Header squadra */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-200 bg-stone-50">
                <div className="w-10 h-10 bg-stone-200 rounded-full animate-pulse shrink-0" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-stone-200 rounded animate-pulse mb-1" />
                  <div className="h-3 w-20 bg-stone-200 rounded animate-pulse" />
                </div>
              </div>
              {/* Righe giocatori */}
              <div className="divide-y divide-stone-100">
                {Array.from({ length: 8 }).map((_, pi) => (
                  <div key={pi} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-8 h-4 bg-stone-200 rounded animate-pulse shrink-0" />
                    <div
                      className="h-4 bg-stone-200 rounded animate-pulse"
                      style={{ width: `${90 + (pi % 4) * 15}px` }}
                    />
                    <div className="flex-1" />
                    <div className="w-16 h-3 bg-stone-200 rounded animate-pulse" />
                    <div className="w-10 h-3 bg-stone-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
