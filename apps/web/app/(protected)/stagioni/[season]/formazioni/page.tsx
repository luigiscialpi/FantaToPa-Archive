// apps/web/app/(protected)/stagioni/[season]/formazioni/page.tsx
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '../../../../../lib/supabase/server';
import { getCompetitions, getSeasons } from '../../../../../lib/queries/seasons';
import { getBonusKinds, getFormazioni, getGironeFormazioni, getMatchdayOptions } from '../../../../../lib/queries/formazioni';
import { getSessionState } from '../../../../../lib/auth/session';
import { MatchdaySelector } from '../../../../../components/formazioni/MatchdaySelector';
import { FormazioniList } from '../../../../../components/formazioni/FormazioniList';
import { GironeFormazioniList } from '../../../../../components/formazioni/GironeFormazioniList';
import { DataGapNotice } from '../../../../../components/shared/DataGapNotice';
import { ScrollToAnchor } from '../../../../../components/shared/ScrollToAnchor';
import { EditModeToggle } from '../../../../../components/admin/EditModeToggle';

type FormazioniPageProps = {
  params: Promise<{ season: string }>;
  searchParams: Promise<{ competizione?: string; giornata?: string; partita?: string; modifica?: string }>;
};

export default async function FormazioniPage({ params, searchParams }: FormazioniPageProps) {
  const { season: seasonSlug } = await params;
  const { competizione, giornata, partita, modifica } = await searchParams;

  const supabase = await createClient();
  const session = await getSessionState();
  const isAdmin = session.kind === 'autenticato' && session.profile.role === 'admin';
  const editMode = isAdmin && modifica === '1';
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

  const matchdays = await getMatchdayOptions(supabase, activeCompetition.id);

  if (matchdays.length === 0) {
    return (
      <main>
        <div className="p-4">
          <h1 className="font-serif font-bold text-xl text-brand-950 mb-1">{season.label}</h1>
          <p className="text-sm text-stone-500 mb-4">{activeCompetition.name}</p>
          <DataGapNotice message="Le formazioni di questa competizione non sono disponibili: i dati sorgente per questa stagione non le includono." />
        </div>
      </main>
    );
  }

  const requestedNumber = giornata ? Number(giornata) : null;
  const activeMatchday =
    (requestedNumber !== null ? matchdays.find((candidate) => candidate.number === requestedNumber) : null) ??
    matchdays[0];

  if (!activeMatchday) {
    notFound();
  }

  const emptyMessage =
    'Le formazioni di questa giornata non sono disponibili: i dati sorgente per questa stagione non le includono.';

  const bonusKinds = editMode ? await getBonusKinds(supabase) : [];

  // Coppa Girone A/B (format_code 'gironi'): "formula uno", non sfide 1v1 —
  // vedi getGironeFormazioni. Il resto delle competizioni (campionato,
  // fase finale) mantiene le MatchCard a coppie di sempre.
  let content: ReactNode;
  if (activeCompetition.formatCode === 'gironi') {
    const teams = await getGironeFormazioni(supabase, activeMatchday.id, season.id);
    content =
      teams.length === 0 ? (
        <DataGapNotice message={emptyMessage} />
      ) : (
        <GironeFormazioniList teams={teams} editMode={editMode} bonusKinds={bonusKinds} />
      );
  } else {
    const matches = await getFormazioni(supabase, activeMatchday.id, season.id);
    // Se ?partita= non corrisponde a nessuna partita di questa giornata
    // (link stantio, o giornata cambiata), si ricade sul default (prima
    // partita) invece di ignorare silenziosamente il match del tutto.
    const activeMatchId = partita && matches.some((match) => match.matchId === partita) ? partita : null;
    content =
      matches.length === 0 ? (
        <DataGapNotice message={emptyMessage} />
      ) : (
        <FormazioniList matches={matches} initialExpandedMatchId={activeMatchId} editMode={editMode} bonusKinds={bonusKinds} />
      );
  }

  return (
    <main>
      <ScrollToAnchor />
      <div className="p-4">
        <div className="flex flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="font-serif font-bold text-xl text-brand-950 mb-0.5">{season.label}</h1>
            <p className="text-xs sm:text-sm text-stone-500">{activeCompetition.name}</p>
          </div>
          {/* Su mobile "Modifica" sopra la select giornata (non affiancati:
              la select troncava a "37ª giornat"), da sm in su tornano sulla
              stessa riga. */}
          <div className="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-2">
            {isAdmin && (
              <Suspense>
                <EditModeToggle active={editMode} />
              </Suspense>
            )}
            <MatchdaySelector
              seasonSlug={season.slug}
              competitionSlug={activeCompetition.slug}
              matchdays={matchdays}
              activeMatchdayNumber={activeMatchday.number}
            />
          </div>
        </div>
        {content}
      </div>
    </main>
  );
}
