// apps/web/components/home/TeamPanel.tsx
//
// Pannello squadra personale (piano, sezione 10, punto 1): renderizzato dalla
// Home solo se il profilo ha una squadra assegnata (profiles.team_id). Ogni
// tessera degrada a un messaggio neutro quando manca il dato, invece di
// nascondersi o mostrare zeri fabbricati.
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Trophy, Swords, TrendingUp } from 'lucide-react';
import { Crest } from '../shared/Crest';
import { StatCard } from './StatCard';
import { StandingSparkline } from './StandingSparkline';
import { RosterLoyaltyCard } from './RosterLoyaltyCard';
import { BestRivalsCard } from './BestRivalsCard';
import { WorstRivalsCard } from './WorstRivalsCard';
import type {
  TitleCounts,
  RivalryHighlight,
  MatchHighlight,
  StandingHistoryPoint,
  RosterLoyaltyEntry,
  OpponentRecord,
} from '../../lib/queries/home';

type CurrentStanding = {
  position: number | null;
  points: number | null;
  leaderPoints: number | null;
};

type TeamPanelProps = {
  teamName: string;
  logoUrl: string | null;
  seasonSlug: string;
  standing: CurrentStanding | null;
  standingHistory: StandingHistoryPoint[];
  titles: TitleCounts;
  rivalry: RivalryHighlight | null;
  records: { best: MatchHighlight | null; worst: MatchHighlight | null };
  loyalty: RosterLoyaltyEntry[];
  // Le card rosa più costose: passate già pronte per lo streaming (il
  // proprio <Suspense> è montato da TeamPanelSection), non come dati grezzi.
  rosterStatsSlot: ReactNode;
  bestOpponents: OpponentRecord[];
  worstOpponents: OpponentRecord[];
};

function formatMatchdayLink(record: MatchHighlight) {
  const href = `/stagioni/${record.seasonSlug}/calendario?competizione=${record.competitionSlug}#giornata-${record.matchdayNumber}`;
  return (
    <Link href={href} className="underline decoration-stone-300 underline-offset-2 hover:text-brand-700">
      {record.matchdayNumber}ª giornata ({record.seasonLabel})
    </Link>
  );
}

export function TeamPanel({
  teamName,
  logoUrl,
  seasonSlug,
  standing,
  standingHistory,
  titles,
  rivalry,
  records,
  loyalty,
  rosterStatsSlot,
  bestOpponents,
  worstOpponents,
}: TeamPanelProps) {
  const gap =
    standing && standing.leaderPoints !== null && standing.points !== null ? standing.leaderPoints - standing.points : null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Crest name={teamName} imageUrl={logoUrl} />
        <h2 className="font-serif font-bold text-lg text-brand-950">
          {teamName}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Storico"
          href={`/stagioni/${seasonSlug}/classifica`}
        >
          {standing?.position ? (
            <>
              <div className="font-serif text-2xl font-bold tabular-nums text-brand-800">
                Ultima stagione: {standing.position}°
              </div>
              <div className="text-xs text-stone-500">
                {standing.points ?? "–"} pt
                {gap !== null && gap > 0 && <> · a {gap} dalla vetta</>}
                {gap === 0 && <> · in vetta</>}
              </div>
            </>
          ) : (
            <div className="text-sm text-stone-400">Non in classifica quest&apos;anno</div>
          )}
          {/* Indipendente dalla stagione corrente: una squadra assente
              quest'anno può comunque avere uno storico da mostrare. */}
          <StandingSparkline history={standingHistory} />
        </StatCard>

        <StatCard label="Bacheca">
          <Trophy size={18} className="mb-1 text-amber-500" />
          <div className="text-sm text-stone-700">
            Campionati: <strong>{titles.campionati}</strong>
          </div>
          <div className="text-sm text-stone-700">
            Coppe: <strong>{titles.coppe}</strong>
          </div>
          <div className="text-xs text-stone-500">
            2° posto: <strong>{titles.secondiCampionato}</strong> · 3° posto: <strong>{titles.terziCampionato}</strong>
          </div>
        </StatCard>

        <StatCard label="Avversario più incontrato">
          {rivalry ? (
            <>
              <Swords size={18} className="mb-1 text-brand-500" />
              <div className="truncate text-sm font-semibold text-stone-800">
                {rivalry.opponentName}
              </div>
              <div className="text-xs text-stone-500">
                {rivalry.won}V {rivalry.drawn}N {rivalry.lost}P su{" "}
                {rivalry.played}
              </div>
            </>
          ) : (
            <div className="text-sm text-stone-400">Ancora nessuna storia</div>
          )}
        </StatCard>

        <RosterLoyaltyCard loyalty={loyalty} />

        {rosterStatsSlot}

        <StatCard label="Record personali">
          <TrendingUp size={18} className="mb-1 text-emerald-600" />
          {records.best ? (
            <div className="mb-1.5 text-xs text-stone-600">
              Migliore:{" "}
              <strong className="text-stone-800">{records.best.score}</strong>{" "}
              vs {records.best.opponentName}
              <div className="text-[11px] text-stone-500">
                {formatMatchdayLink(records.best)}
              </div>
            </div>
          ) : (
            <div className="mb-1 text-xs text-stone-400">Nessun dato</div>
          )}
          {records.worst && (
            <div className="text-xs text-stone-600">
              Peggiore:{" "}
              <strong className="text-stone-800">{records.worst.score}</strong>{" "}
              vs {records.worst.opponentName}
              <div className="text-[11px] text-stone-500">
                {formatMatchdayLink(records.worst)}
              </div>
            </div>
          )}
        </StatCard>

        <BestRivalsCard records={bestOpponents} />

        <WorstRivalsCard records={worstOpponents} />
      </div>
    </section>
  );
}
