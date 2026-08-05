// apps/web/components/home/TeamQuickPanel.tsx
//
// Versione leggera del pannello squadra per la Home: solo dati già
// disponibili in page.tsx (niente query pesanti come rivalità/record/
// storico/fedeltà rosa/avversari, quelle sono in TeamPanelSection, ora
// riservata a /profilo-squadra) più una card-invito a Profilo Squadra per
// chi vuole approfondire.
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Crest } from '../shared/Crest';
import { StatCard } from './StatCard';
import type { StandingsRow } from '../../lib/queries/classifica';

type TeamQuickPanelProps = {
  teamName: string;
  teamSlug: string;
  logoUrl: string | null;
  seasonSlug: string;
  ownStanding: StandingsRow | null;
  leaderStanding: StandingsRow | null;
};

export function TeamQuickPanel({ teamName, teamSlug, logoUrl, seasonSlug, ownStanding, leaderStanding }: TeamQuickPanelProps) {
  const gap =
    ownStanding && leaderStanding && ownStanding.points !== null && leaderStanding.points !== null
      ? leaderStanding.points - ownStanding.points
      : null;

  return (
    <div className="border-b border-stone-200 p-4">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Crest name={teamName} imageUrl={logoUrl} />
          <h2 className="font-serif font-bold text-lg text-brand-950">{teamName}</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Ultima stagione" href={`/stagioni/${seasonSlug}/classifica`}>
            {ownStanding?.position ? (
              <>
                <div className="font-serif text-2xl font-bold tabular-nums text-brand-800">{ownStanding.position}°</div>
                <div className="text-xs text-stone-500">
                  {ownStanding.points ?? '–'} pt
                  {gap !== null && gap > 0 && <> · a {gap} dalla vetta</>}
                  {gap === 0 && <> · in vetta</>}
                </div>
              </>
            ) : (
              <div className="text-sm text-stone-400">Ancora nessun dato</div>
            )}
          </StatCard>

          <Link
            href={`/profilo-squadra?squadra=${teamSlug}`}
            className="group flex h-full flex-col justify-between rounded-xl border border-brand-200 bg-brand-50 p-4 transition-colors hover:border-brand-400 hover:bg-brand-100"
          >
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-500">Vuoi saperne di più sul tuo percorso?</div>
              <div className="text-sm font-semibold text-brand-900">Bacheca, rivalità storiche, record e tanto altro</div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 group-hover:text-brand-900">
              Vai al Profilo Squadra <ArrowRight size={16} />
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
