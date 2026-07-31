// apps/web/components/home/LeagueShowcase.tsx
//
// Vetrina generale (piano, sezione 10, punto 2): visibile a chiunque sia
// approvato, con o senza squadra assegnata — digest verso le pagine
// dedicate (Calendario, Classifica), non una loro duplicazione. Niente link
// per "Squadra più titolata": /albo-doro non esiste ancora come pagina.
import Link from 'next/link';
import { Flame, Trophy } from 'lucide-react';
import { Crest } from '../shared/Crest';
import { StatCard } from './StatCard';
import type { StandingsRow } from '../../lib/queries/classifica';
import type { LatestMatchday, BiggestWin, MatchHighlight, TitleCounts } from '../../lib/queries/home';

type LeagueShowcaseProps = {
  seasonSlug: string;
  latestMatchday: LatestMatchday | null;
  standingsTop3: StandingsRow[];
  userStandingRow: StandingsRow | null;
  leagueRecords: { highestScore: MatchHighlight | null; biggestWin: BiggestWin | null };
  mostTitled: { teamName: string; titles: TitleCounts } | null;
};

function formatMatchdayLink(record: MatchHighlight) {
  const href = `/stagioni/${record.seasonSlug}/calendario?competizione=${record.competitionSlug}#giornata-${record.matchdayNumber}`;
  return (
    <Link href={href} className="underline decoration-stone-300 underline-offset-2 hover:text-brand-700">
      {record.matchdayNumber}ª giornata ({record.seasonLabel})
    </Link>
  );
}

export function LeagueShowcase({
  seasonSlug,
  latestMatchday,
  standingsTop3,
  userStandingRow,
  leagueRecords,
  mostTitled,
}: LeagueShowcaseProps) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Dalla lega</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label={latestMatchday ? `Ultimi risultati · ${latestMatchday.number}ª giornata` : 'Ultimi risultati'}
          href={`/stagioni/${seasonSlug}/calendario`}
        >
          {latestMatchday && latestMatchday.matches.length > 0 ? (
            <div className="space-y-1.5">
              {latestMatchday.matches.map((match, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-stone-700">{match.homeTeamName}</span>
                  <span className="shrink-0 whitespace-nowrap font-serif font-bold tabular-nums text-brand-800">
                    {match.homeScore ?? '–'} - {match.awayScore ?? '–'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-right text-stone-700">{match.awayTeamName}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-stone-400">Nessuna partita ancora giocata</div>
          )}
        </StatCard>

        <StatCard label="Classifica in breve" href={`/stagioni/${seasonSlug}/classifica`}>
          <div className="space-y-1.5">
            {standingsTop3.map((row) => (
              <div key={row.teamId} className="flex items-center gap-2 text-sm">
                <span className="w-4 tabular-nums text-stone-400">{row.position}</span>
                <Crest name={row.teamName} imageUrl={row.jerseyUrl} />
                <span className="flex-1 truncate text-stone-700">{row.teamName}</span>
                <span className="font-serif font-bold tabular-nums text-brand-800">{row.points ?? '–'}</span>
              </div>
            ))}
            {userStandingRow && (
              <div className="mt-1 flex items-center gap-2 border-t border-stone-100 pt-1 text-sm">
                <span className="w-4 tabular-nums text-stone-400">{userStandingRow.position}</span>
                <Crest name={userStandingRow.teamName} imageUrl={userStandingRow.jerseyUrl} highlight />
                <span className="flex-1 truncate font-semibold text-stone-800">{userStandingRow.teamName}</span>
                <span className="font-serif font-bold tabular-nums text-brand-800">{userStandingRow.points ?? '–'}</span>
              </div>
            )}
          </div>
        </StatCard>

        <StatCard label="Record della lega">
          <Flame size={18} className="mb-1 text-orange-500" />
          {leagueRecords.highestScore ? (
            <div className="mb-1.5 text-xs text-stone-600">
              Punteggio più alto: <strong className="text-stone-800">{leagueRecords.highestScore.score}</strong> (
              {leagueRecords.highestScore.teamName})
              <div className="text-[11px] text-stone-500">{formatMatchdayLink(leagueRecords.highestScore)}</div>
            </div>
          ) : (
            <div className="mb-1 text-xs text-stone-400">Nessun dato</div>
          )}
          {leagueRecords.biggestWin && (
            <div className="text-xs text-stone-600">
              Vittoria più larga: <strong className="text-stone-800">{leagueRecords.biggestWin.teamName}</strong>{' '}
              {leagueRecords.biggestWin.score}-{leagueRecords.biggestWin.opponentScore} {leagueRecords.biggestWin.opponentName}
              <div className="text-[11px] text-stone-500">{formatMatchdayLink(leagueRecords.biggestWin)}</div>
            </div>
          )}
        </StatCard>

        <StatCard label="Squadra più titolata">
          <Trophy size={18} className="mb-1 text-amber-500" />
          {mostTitled ? (
            <>
              <div className="text-sm font-semibold text-stone-800">{mostTitled.teamName}</div>
              <div className="text-xs text-stone-500">
                {mostTitled.titles.campionati} campionat{mostTitled.titles.campionati === 1 ? 'o' : 'i'} ·{' '}
                {mostTitled.titles.coppe} {mostTitled.titles.coppe === 1 ? 'coppa' : 'coppe'}
              </div>
            </>
          ) : (
            <div className="text-sm text-stone-400">Ancora nessun dato</div>
          )}
        </StatCard>
      </div>
    </section>
  );
}
