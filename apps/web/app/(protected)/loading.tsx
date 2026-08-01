// Skeleton della Home: ricalca pannello squadra + galleria stagioni +
// vetrina generale (stesso ordine reale di page.tsx — prima era invertito
// rispetto a galleria/vetrina e causava un salto di layout al primo swap).
// Condiviso con i confini <Suspense> dentro page.tsx (components/home/
// HomeSkeletons.tsx): questo file copre solo la primissima navigazione,
// prima che HomePage inizi a renderizzare.
import { TeamPanelSkeleton, SeasonGallerySkeleton, LeagueShowcaseSkeleton } from '../../components/home/HomeSkeletons';

export default function HomeLoading() {
  return (
    <main>
      <TeamPanelSkeleton />
      <SeasonGallerySkeleton />
      <LeagueShowcaseSkeleton />
    </main>
  );
}

