// apps/web/app/(protected)/albo-doro/page.tsx
//
// Route top-level (non sotto stagioni/[season]/**): l'Albo d'Oro fa
// eccezione al selettore stagione persistente, mostra tutte le annate
// insieme (piano, sezione 10). Riusa getSeasonGallery tramite
// AlboDoroSection: stessa query già usata dalla galleria stagioni della
// Home, nessuna nuova query necessaria.
import { Suspense } from 'react';
import { getSessionState } from '../../../lib/auth/session';
import { AlboDoroSection } from '../../../components/albo-doro/AlboDoroSection';
import { AlboDoroSkeleton } from '../../../components/albo-doro/AlboDoroSkeleton';

export default async function AlboDoroPage() {
  const session = await getSessionState();
  const profile = session.kind === 'autenticato' ? session.profile : null;

  return (
    <main className="p-4">
      <h1 className="mb-1 font-serif font-bold text-xl text-brand-950">Albo d&apos;Oro</h1>
      <p className="mb-4 text-sm text-stone-500">Podio Campionato e vincitore Coppa, stagione per stagione.</p>
      <Suspense fallback={<AlboDoroSkeleton />}>
        <AlboDoroSection userTeamId={profile?.teamId} />
      </Suspense>
    </main>
  );
}
