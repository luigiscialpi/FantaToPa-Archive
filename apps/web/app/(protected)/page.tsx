import { createClient } from '../../lib/supabase/server';
import { getSessionState } from '../../lib/auth/session';
import { getCompetitions, getSeasons } from '../../lib/queries/seasons';
import { getStandings } from '../../lib/queries/classifica';
import { getTeamBranding, brandingFor } from '../../lib/queries/team-branding';
import {
  getAllTimeTitleCounts,
  getLatestMatchdayResults,
  getLeagueRecords,
  getMostFieldedPlayer,
  getMostTitledTeam,
  getPersonalRecords,
  getRivalryHighlight,
  getSeasonGallery,
  type FieldedPlayer,
  type MatchHighlight,
  type RivalryHighlight,
  type TitleCounts,
} from '../../lib/queries/home';
import { TeamPanel } from '../../components/home/TeamPanel';
import { LeagueShowcase } from '../../components/home/LeagueShowcase';
import { SeasonGallery } from '../../components/home/SeasonGallery';

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

  const [standings, latestMatchday, leagueRecords, mostTitled, seasonGallery] = await Promise.all([
    campionato ? getStandings(supabase, campionato.id, latestSeason.id) : Promise.resolve([]),
    campionato ? getLatestMatchdayResults(supabase, campionato.id, latestSeason.id) : Promise.resolve(null),
    getLeagueRecords(supabase),
    getMostTitledTeam(supabase),
    getSeasonGallery(supabase),
  ]);

  const standingsTop3 = standings.slice(0, 3);
  const userStandingRow = profile?.teamId
    ? (standings.find((row) => row.teamId === profile.teamId && !standingsTop3.includes(row)) ?? null)
    : null;

  let teamPanel: {
    teamName: string;
    logoUrl: string | null;
    standing: { position: number | null; points: number | null; leaderPoints: number | null } | null;
    titles: TitleCounts;
    rivalry: RivalryHighlight | null;
    records: { best: MatchHighlight | null; worst: MatchHighlight | null };
    keyPlayer: FieldedPlayer | null;
  } | null = null;

  if (profile?.teamId) {
    const teamId = profile.teamId;
    const [titleCounts, rivalry, records, keyPlayer, branding, teamRow] = await Promise.all([
      getAllTimeTitleCounts(supabase),
      getRivalryHighlight(supabase, teamId),
      getPersonalRecords(supabase, teamId),
      getMostFieldedPlayer(supabase, teamId),
      getTeamBranding(supabase, latestSeason.id, [teamId]),
      supabase.from('teams').select('canonical_name').eq('id', teamId).maybeSingle(),
    ]);

    if (teamRow.error) {
      throw new Error(`Impossibile leggere la squadra: ${teamRow.error.message}`);
    }

    const ownStanding = standings.find((row) => row.teamId === teamId) ?? null;
    const leaderStanding = standings.find((row) => row.position === 1) ?? null;

    teamPanel = {
      teamName: teamRow.data?.canonical_name ?? ownStanding?.teamName ?? 'La tua squadra',
      logoUrl: brandingFor(branding, teamId).logoUrl,
      standing: ownStanding
        ? { position: ownStanding.position, points: ownStanding.points, leaderPoints: leaderStanding?.points ?? null }
        : null,
      titles: titleCounts.get(teamId) ?? { campionati: 0, coppe: 0 },
      rivalry,
      records,
      keyPlayer,
    };
  }

  return (
    <main>
      {teamPanel && (
        <div className="border-b border-stone-200 p-4">
          <TeamPanel
            teamName={teamPanel.teamName}
            logoUrl={teamPanel.logoUrl}
            seasonSlug={latestSeason.slug}
            standing={teamPanel.standing}
            titles={teamPanel.titles}
            rivalry={teamPanel.rivalry}
            records={teamPanel.records}
            keyPlayer={teamPanel.keyPlayer}
          />
        </div>
      )}
      <div className="p-4">
        <SeasonGallery seasons={seasonGallery} />
      </div>
      <div className="border-b border-stone-200 p-4">
        <LeagueShowcase
          seasonSlug={latestSeason.slug}
          latestMatchday={latestMatchday}
          standingsTop3={standingsTop3}
          userStandingRow={userStandingRow}
          leagueRecords={leagueRecords}
          mostTitled={mostTitled}
        />
      </div>
    </main>
  );
}
