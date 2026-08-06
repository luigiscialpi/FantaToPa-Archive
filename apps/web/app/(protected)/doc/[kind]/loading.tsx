// apps/web/app/(protected)/doc/[kind]/loading.tsx
export default function DocKindLoading() {
  return (
    <main className="p-4 max-w-3xl mx-auto">
      <div className="mb-1 h-6 w-56 animate-pulse rounded bg-stone-200" />
      <div className="mb-4 h-4 w-40 animate-pulse rounded bg-stone-200" />
      <div className="space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-stone-200" />
        <div className="h-4 w-full animate-pulse rounded bg-stone-200" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200" />
      </div>
    </main>
  );
}
