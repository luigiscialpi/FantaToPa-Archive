// Skeleton della Home: ricalca hero stagione + pannello squadra leggero +
// vetrina generale (stesso ordine reale di page.tsx).
// Condiviso con i confini <Suspense> dentro page.tsx (components/home/
// HomeSkeletons.tsx): questo file copre solo la primissima navigazione,
// prima che HomePage inizi a renderizzare.
import { SeasonHeroSkeleton, TeamQuickPanelSkeleton, LeagueShowcaseSkeleton } from '../../components/home/HomeSkeletons';

export default function HomeLoading() {
  return (
    <main>
      <SeasonHeroSkeleton />
      <TeamQuickPanelSkeleton />
      <LeagueShowcaseSkeleton />
    </main>
  );
}

