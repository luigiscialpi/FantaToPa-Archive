import { Suspense } from 'react';
import { createClient } from '../../lib/supabase/server';
import { getSessionState } from '../../lib/auth/session';
import { getCompetitions, getSeasons } from '../../lib/queries/seasons';
import { getStandings } from '../../lib/queries/classifica';
import { TeamPanelSection } from '../../components/home/TeamPanelSection';
import { SeasonGallerySection } from '../../components/home/SeasonGallerySection';
import { LeagueShowcaseSection } from '../../components/home/LeagueShowcaseSection';
import { TeamPanelSkeleton, SeasonGallerySkeleton, LeagueShowcaseSkeleton } from '../../components/home/HomeSkeletons';

export default async function HomePage() {
  const supabase = await createClient();
  // getSessionState()/getSeasons() sono wrappate in cache(): il layout
  // protetto ha già invocato la prima in questa stessa render request
  // (AGENTS.md), qui è un re-uso gratuito, non una query in più.
  const [session, seasons] = await Promise.all([getSessionState(), getSeasons(supabase)]);
  const profile = session.kind === 'autenticato' ? session.profile : null;
  const latestSeason = seasons[0];

  if (!latestSeason) {
    return (
      <div className="p-4">
        <p className="text-sm text-stone-500">Nessuna stagione ancora importata.</p>
      </div>
    );
  }

  const competitions = await getCompetitions(supabase, latestSeason.id);
  const campionato = competitions.find((competition) => competition.kindCode === 'campionato') ?? null;

  // Classifica dell'ultima stagione: leggera (una sola competizione, poche
  // righe), resta eager qui — serve sia al pannello squadra sia alla vetrina
  // generale, e duplicarla in due sezioni <Suspense> indipendenti costerebbe
  // una query in più senza benefici di percezione (non è lei il collo di
  // bottiglia: le query pesanti sono quelle su tutte le stagioni, isolate
  // nelle 3 sezioni sotto).
  const standings = campionato ? await getStandings(supabase, campionato.id, latestSeason.id) : [];
  const standingsTop3 = standings.slice(0, 3);
  const userStandingRow = profile?.teamId
    ? (standings.find((row) => row.teamId === profile.teamId && !standingsTop3.includes(row)) ?? null)
    : null;
  const ownStanding = profile?.teamId ? (standings.find((row) => row.teamId === profile.teamId) ?? null) : null;
  const leaderStanding = standings.find((row) => row.position === 1) ?? null;

  // Le 3 sezioni sotto sono Server Component asincroni indipendenti, ognuna
  // con le proprie query e il proprio confine <Suspense>: possono comparire
  // in streaming man mano che i rispettivi dati sono pronti, invece di
  // bloccare l'intera pagina finché la più lenta non finisce (in
  // precedenza tutte le query — comprese quelle su tutte le stagioni per
  // bacheca/galleria/vetrina — erano in un unico await prima del render).
  return (
    <main>
      {profile?.teamId && (
        <Suspense fallback={<TeamPanelSkeleton />}>
          <TeamPanelSection
            teamId={profile.teamId}
            seasonId={latestSeason.id}
            seasonSlug={latestSeason.slug}
            ownStanding={ownStanding}
            leaderStanding={leaderStanding}
          />
        </Suspense>
      )}
      <Suspense fallback={<SeasonGallerySkeleton />}>
        <SeasonGallerySection userTeamId={profile?.teamId} />
      </Suspense>
      <Suspense fallback={<LeagueShowcaseSkeleton />}>
        <LeagueShowcaseSection
          seasonId={latestSeason.id}
          seasonSlug={latestSeason.slug}
          campionatoId={campionato?.id ?? null}
          standingsTop3={standingsTop3}
          userStandingRow={userStandingRow}
        />
      </Suspense>
    </main>
  );
}
