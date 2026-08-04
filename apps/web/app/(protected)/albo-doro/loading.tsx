// apps/web/app/(protected)/albo-doro/loading.tsx
//
// Skeleton coerente con la struttura reale della pagina (sezione 10 del
// piano): titolo + una card per stagione, non uno spinner generico.
export default function AlboDoroLoading() {
  return (
    <main className="p-4">
      <div className="mb-1 h-6 w-40 animate-pulse rounded bg-stone-200" />
      <div className="mb-4 h-4 w-64 animate-pulse rounded bg-stone-200" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="mb-3 h-4 w-24 animate-pulse rounded bg-stone-200" />
            <div className="h-24 animate-pulse rounded bg-stone-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
