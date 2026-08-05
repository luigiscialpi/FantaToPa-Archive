// apps/web/app/(protected)/stagioni/[season]/calendario/page.tsx
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { createClient } from '../../../../../lib/supabase/server';
import { getCompetitions, getSeasons } from '../../../../../lib/queries/seasons';
import { getCalendario, getGironeCalendario } from '../../../../../lib/queries/calendario';
import { getSessionState } from '../../../../../lib/auth/session';
import { MatchdayGroup } from '../../../../../components/calendario/MatchdayGroup';
import { GironeMatchdayGroup } from '../../../../../components/calendario/GironeMatchdayGroup';
import { MatchdayJumpBar } from '../../../../../components/calendario/MatchdayJumpBar';
import { DataGapNotice } from '../../../../../components/shared/DataGapNotice';
import { ScrollToAnchor } from '../../../../../components/shared/ScrollToAnchor';
import { EditModeToggle } from '../../../../../components/admin/EditModeToggle';

type CalendarioPageProps = {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ competizione?: string; modifica?: string }>;
};

export default async function CalendarioPage({ params, searchParams }: CalendarioPageProps) {
  const { season: seasonSlug } = await params;
  const { competizione, modifica } = await searchParams;

  const supabase = await createClient();
  const session = await getSessionState();
  const isAdmin = session.kind === 'autenticato' && session.profile.role === 'admin';
  const seasons = await getSeasons(supabase);
  const season = seasons.find((candidate) => candidate.slug === seasonSlug);

  if (!season) {
    notFound();
  }

  const competitions = await getCompetitions(supabase, season.id);
  const activeCompetition = competizione
    ? competitions.find((candidate) => candidate.slug === competizione)
    : competitions[0];

  if (!activeCompetition) {
    notFound();
  }

  const emptyMessage = 'Il calendario di questa competizione non è disponibile: i dati sorgente per questa stagione non lo includono.';

  // Coppa Girone A/B (format_code 'gironi'): "formula uno", non sfide 1v1 —
  // vedi getGironeCalendario. Il resto delle competizioni (campionato, fase
  // finale) mantiene le MatchRow a coppie di sempre.
  // Editing solo per le MatchRow a coppie: la vista girone non ha un form
  // per riga (le righe sono squadre singole ricavate in memoria, non hanno
  // un id di partita 1:1 utilizzabile per il salvataggio).
  const editMode = isAdmin && modifica === '1' && activeCompetition.formatCode !== 'gironi';
  let matchdaysCount: number;
  let content: ReactNode;
  let jumpBarMatchdays: { id: string; number: number; label: string | null }[];
  if (activeCompetition.formatCode === 'gironi') {
    const matchdays = await getGironeCalendario(supabase, activeCompetition.id, season.id);
    matchdaysCount = matchdays.length;
    jumpBarMatchdays = matchdays;
    content =
      matchdays.length === 0 ? (
        <DataGapNotice message={emptyMessage} />
      ) : (
        matchdays.map((matchday) => (
          <GironeMatchdayGroup
            key={matchday.id}
            matchday={matchday}
            seasonSlug={season.slug}
            competitionSlug={activeCompetition.slug}
          />
        ))
      );
  } else {
    const matchdays = await getCalendario(supabase, activeCompetition.id, season.id);
    matchdaysCount = matchdays.length;
    jumpBarMatchdays = matchdays;
    content =
      matchdays.length === 0 ? (
        <DataGapNotice message={emptyMessage} />
      ) : (
        matchdays.map((matchday) => (
          <MatchdayGroup
            key={matchday.id}
            matchday={matchday}
            seasonSlug={season.slug}
            competitionSlug={activeCompetition.slug}
            editMode={editMode}
          />
        ))
      );
  }

  return (
    <main>
      <ScrollToAnchor />
      <div className="p-4">
        <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="font-serif font-bold text-xl text-brand-950 mb-0.5">{season.label}</h1>
            <p className="text-xs sm:text-sm text-stone-500">{activeCompetition.name}</p>
          </div>
          <div className="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-2">
            {isAdmin && activeCompetition.formatCode !== 'gironi' && (
              <Suspense>
                <EditModeToggle active={editMode} />
              </Suspense>
            )}
            {matchdaysCount > 0 && <MatchdayJumpBar matchdays={jumpBarMatchdays} />}
          </div>
        </div>
        {content}
      </div>
    </main>
  );
}
