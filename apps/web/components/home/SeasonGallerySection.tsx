// apps/web/components/home/SeasonGallerySection.tsx
//
// Galleria stagioni come Server Component asincrono indipendente, per poterla
// avvolgere in un proprio <Suspense> (vedi page.tsx): getSeasonGallery
// attraversa tutte le stagioni (podio campionato + finale coppa per
// ciascuna, vedi getCupFinalWinners in lib/queries/home.ts) e non deve
// bloccare il rendering di pannello squadra/vetrina generale.
import { createClient } from '../../lib/supabase/server';
import { getSeasonGallery } from '../../lib/queries/home';
import { SeasonGallery } from './SeasonGallery';

type SeasonGallerySectionProps = {
  userTeamId?: string | null;
};

export async function SeasonGallerySection({ userTeamId }: SeasonGallerySectionProps) {
  const supabase = await createClient();
  const seasons = await getSeasonGallery(supabase, userTeamId);

  return (
    <div className="p-4">
      <SeasonGallery seasons={seasons} />
    </div>
  );
}
