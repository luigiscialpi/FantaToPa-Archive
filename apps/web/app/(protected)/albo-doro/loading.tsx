// apps/web/app/(protected)/albo-doro/loading.tsx
//
// Skeleton coerente con la struttura reale della pagina (griglia di card,
// stessa di AlboDoroSkeleton). Usa lo stesso componente del fallback
// <Suspense> in page.tsx per evitare che, navigando da un'altra route, si
// veda prima uno skeleton e poi un altro.
import { AlboDoroSkeleton } from '../../../components/albo-doro/AlboDoroSkeleton';

export default function AlboDoroLoading() {
  return (
    <main className="p-4">
      <div className="mb-1 h-6 w-40 animate-pulse rounded bg-stone-200" />
      <div className="mb-4 h-4 w-64 animate-pulse rounded bg-stone-200" />
      <AlboDoroSkeleton />
    </main>
  );
}
