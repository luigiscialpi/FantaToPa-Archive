// apps/web/app/(protected)/stagioni/[season]/rose/page.tsx
import { notFound } from 'next/navigation';
import { createClient } from '../../../../../lib/supabase/server';
import { getSeasons } from '../../../../../lib/queries/seasons';
import { getRoster, getTeamsWithRoster } from '../../../../../lib/queries/rose';
import { TeamSwitcher } from '../../../../../components/rose/TeamSwitcher';
import { RosterTable } from '../../../../../components/rose/RosterTable';

type RosePageProps = {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ squadra?: string }>;
};

export default async function RosePage({ params, searchParams }: RosePageProps) {
  const { season: seasonSlug } = await params;
  const { squadra } = await searchParams;

  const supabase = await createClient();
  const seasons = await getSeasons(supabase);
  const season = seasons.find((candidate) => candidate.slug === seasonSlug);

  if (!season) {
    notFound();
  }

  const teams = await getTeamsWithRoster(supabase, season.id);

  if (teams.length === 0) {
    return (
      <main>
        <div className="p-4">
          <h1 className="font-serif font-bold text-xl text-brand-950 mb-1">{season.label}</h1>
          <p className="text-sm text-stone-500">Rose non disponibili per questa stagione.</p>
        </div>
      </main>
    );
  }

  const activeTeam = squadra ? teams.find((candidate) => candidate.slug === squadra) : teams[0];

  if (!activeTeam) {
    notFound();
  }

  const players = await getRoster(supabase, season.id, activeTeam.id);

  return (
    <main>
      <div className="p-4">
        <h1 className="font-serif font-bold text-xl text-brand-950 mb-1">{season.label}</h1>
        <p className="text-sm text-stone-500 mb-4">{activeTeam.name}</p>
        <TeamSwitcher teams={teams} activeTeamSlug={activeTeam.slug} />
        <RosterTable players={players} />
      </div>
    </main>
  );
}
