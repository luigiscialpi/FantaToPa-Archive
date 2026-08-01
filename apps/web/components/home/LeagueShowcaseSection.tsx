// apps/web/components/home/LeagueShowcaseSection.tsx
//
// Vetrina generale come Server Component asincrono indipendente, per un
// proprio <Suspense> (vedi page.tsx): getMostTitledTeam attraversa tutte le
// competizioni coppa (derivazione dalla finale, vedi getCupFinalWinners in
// lib/queries/home.ts) e non deve bloccare pannello squadra/galleria
// stagioni. La classifica (standingsTop3/userStandingRow) resta calcolata
// nella page e passata come prop: è leggera (una sola competizione) e serve
// anche al pannello squadra, duplicarla in due sezioni indipendenti
// costerebbe una query in più senza benefici percepibili.
import { createClient } from '../../lib/supabase/server';
import { getLatestMatchdayResults, getLeagueRecords, getMostTitledTeam } from '../../lib/queries/home';
import type { StandingsRow } from '../../lib/queries/classifica';
import { LeagueShowcase } from './LeagueShowcase';

type LeagueShowcaseSectionProps = {
  seasonId: string;
  seasonSlug: string;
  campionatoId: string | null;
  standingsTop3: StandingsRow[];
  userStandingRow: StandingsRow | null;
};

export async function LeagueShowcaseSection({
  seasonId,
  seasonSlug,
  campionatoId,
  standingsTop3,
  userStandingRow,
}: LeagueShowcaseSectionProps) {
  const supabase = await createClient();

  const [latestMatchday, leagueRecords, mostTitled] = await Promise.all([
    campionatoId ? getLatestMatchdayResults(supabase, campionatoId, seasonId) : Promise.resolve(null),
    getLeagueRecords(supabase),
    getMostTitledTeam(supabase),
  ]);

  return (
    <div className="border-b border-stone-200 p-4">
      <LeagueShowcase
        seasonSlug={seasonSlug}
        latestMatchday={latestMatchday}
        standingsTop3={standingsTop3}
        userStandingRow={userStandingRow}
        leagueRecords={leagueRecords}
        mostTitled={mostTitled}
      />
    </div>
  );
}
