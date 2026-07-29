// Skeleton della tabella classifica: ricalca la struttura di ClassificaTable
// (header colonne + 10 righe con crest circolari + barre testo) così il
// passaggio al contenuto reale non causa salti di layout.
export default function ClassificaLoading() {
  return (
    <main>
      <div className="p-4">
        {/* Titolo stagione + competizione */}
        <div className="h-6 w-40 bg-stone-200 rounded animate-pulse mb-1" />
        <div className="h-4 w-28 bg-stone-200 rounded animate-pulse mb-4" />

        {/* Slider giornate (GiornataRangeFilter) */}
        <div className="h-10 w-full bg-stone-100 rounded-lg animate-pulse mb-4" />

        {/* Tabella classifica */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-2 py-2">
            <div className="w-6 h-3 bg-stone-200 rounded animate-pulse" />
            <div className="w-20 h-3 bg-stone-200 rounded animate-pulse" />
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="w-8 h-3 bg-stone-200 rounded animate-pulse" />
            ))}
          </div>
          {/* Righe */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-2.5 border-b border-stone-100 last:border-b-0"
            >
              <div className="w-5 h-4 bg-stone-200 rounded animate-pulse" />
              <div className="w-6 h-6 bg-stone-200 rounded-full animate-pulse shrink-0" />
              <div
                className="h-4 bg-stone-200 rounded animate-pulse"
                style={{ width: `${100 + (i % 3) * 20}px` }}
              />
              <div className="flex-1" />
              {Array.from({ length: 9 }).map((_, j) => (
                <div key={j} className="w-6 h-4 bg-stone-200 rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
