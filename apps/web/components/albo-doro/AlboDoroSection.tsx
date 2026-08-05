// apps/web/components/albo-doro/AlboDoroSection.tsx
//
// Sezione Albo d'Oro come Server Component asincrono indipendente, per
// poterla avvolgere in un proprio <Suspense> (vedi albo-doro/page.tsx):
// getSeasonGallery attraversa tutte le stagioni (podio campionato +
// finale coppa per ciascuna) e non deve bloccare il rendering del
// titolo/sottotitolo della pagina.
import { createClient } from '../../lib/supabase/server';
import { getSeasonGallery } from '../../lib/queries/home';
import { AlboDoroList } from './AlboDoroList';

type AlboDoroSectionProps = {
  userTeamId?: string | null;
};

export async function AlboDoroSection({ userTeamId }: AlboDoroSectionProps) {
  const supabase = await createClient();
  const seasons = await getSeasonGallery(supabase, userTeamId);

  return <AlboDoroList seasons={seasons} />;
}
