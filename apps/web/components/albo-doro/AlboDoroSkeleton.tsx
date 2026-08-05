// apps/web/components/albo-doro/AlboDoroSkeleton.tsx
//
// Fallback del confine <Suspense> in albo-doro/page.tsx: ricalca la
// griglia di card di AlboDoroList (stesso numero di colonne della
// galleria che era in homepage) in modo che lo swap con i dati reali
// non causi salti di layout.
export function AlboDoroSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="mb-4 h-4 w-24 animate-pulse rounded bg-stone-200" />
          <div className="flex items-end justify-center gap-1.5">
            <div className="flex flex-1 flex-col items-center gap-1">
              <div className="h-9 w-9 animate-pulse rounded-full bg-stone-200" />
              <div className="h-3 w-full animate-pulse rounded bg-stone-200" />
              <div className="mt-0.5 h-8 w-full animate-pulse rounded-t-lg bg-stone-200" />
            </div>
            <div className="flex flex-1 flex-col items-center gap-1">
              <div className="h-9 w-9 animate-pulse rounded-full bg-stone-200" />
              <div className="h-3 w-full animate-pulse rounded bg-stone-200" />
              <div className="mt-0.5 h-10 w-full animate-pulse rounded-t-lg bg-stone-200" />
            </div>
            <div className="flex flex-1 flex-col items-center gap-1">
              <div className="h-9 w-9 animate-pulse rounded-full bg-stone-200" />
              <div className="h-3 w-full animate-pulse rounded bg-stone-200" />
              <div className="mt-0.5 h-6 w-full animate-pulse rounded-t-lg bg-stone-200" />
            </div>
          </div>
          <div className="mt-3 flex flex-col items-center gap-1">
            <div className="h-3 w-28 animate-pulse rounded bg-stone-200" />
            <div className="flex items-center justify-center gap-1.5">
              <div className="h-9 w-9 animate-pulse rounded-full bg-stone-200" />
              <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
