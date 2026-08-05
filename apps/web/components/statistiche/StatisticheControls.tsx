// apps/web/components/statistiche/StatisticheControls.tsx
//
// Selettori della pagina Statistiche (stagione, competizione, due squadre,
// tipo di dato) — pagina top-level (non sotto stagioni/[season]/**, la
// stagione qui è solo un filtro), quindi lo stato attivo vive nei
// searchParams della pagina stessa, non nel pathname.
//
// Form non controllato + pulsante "Aggiorna": ogni select è solo una scelta
// in sospeso finché non si preme il pulsante, che sottomette tutto insieme e
// fa partire UNA sola richiesta al server invece di una ad ogni singola
// select onChange (ognuna delle quali rilancerebbe altrimenti getComparableTeams/
// getHeadToHeadSeries). Lo scambio squadre resta invece un'azione immediata:
// è un intento esplicito, non una modifica accidentale in corso.
'use client';

import { useRef, useTransition } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, LoaderCircle } from 'lucide-react';
import type { SeasonOption, CompetitionOption } from '../../lib/queries/seasons';
import type { ComparableTeam } from '../../lib/queries/statistiche';

type StatisticheControlsProps = {
  seasons: SeasonOption[];
  competitions: CompetitionOption[];
  teams: ComparableTeam[];
  seasonSlug: string;
  competitionSlug: string;
  team1Slug: string | null;
  team2Slug: string | null;
  statType: 'punti' | 'fantapunti';
};

export function StatisticheControls({
  seasons,
  competitions,
  teams,
  seasonSlug,
  competitionSlug,
  team1Slug,
  team2Slug,
  statType,
}: StatisticheControlsProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function navigateWith(overrides: Record<string, string | null>) {
    const form = formRef.current;
    const params = new URLSearchParams();
    if (form) {
      for (const element of Array.from(form.elements)) {
        if (element instanceof HTMLSelectElement && element.name) {
          params.set(element.name, element.value);
        }
      }
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    startTransition(() => {
      router.push(`/statistiche?${params.toString()}`);
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    navigateWith({});
  }

  function swapTeams() {
    navigateWith({ squadra1: team2Slug, squadra2: team1Slug });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2 mb-4">
      <div className="flex gap-2">
        <select
          name="stagione"
          defaultValue={seasonSlug}
          className="flex-1 min-w-0 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          {seasons.map((season) => (
            <option key={season.id} value={season.slug}>
              {season.label}
            </option>
          ))}
        </select>
        <select
          name="competizione"
          defaultValue={competitionSlug}
          className="flex-1 min-w-0 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          {competitions.map((competition) => (
            <option key={competition.id} value={competition.slug}>
              {competition.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <select
          name="squadra1"
          defaultValue={team1Slug ?? ''}
          className="flex-1 min-w-0 text-xs font-semibold text-stone-800 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          {teams.map((team) => (
            <option key={team.teamId} value={team.slug}>
              {team.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={swapTeams}
          disabled={isPending}
          aria-label="Scambia le due squadre"
          className="shrink-0 p-1.5 text-stone-400 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 rounded-md disabled:opacity-50"
        >
          <ArrowLeftRight size={15} />
        </button>
        <select
          name="squadra2"
          defaultValue={team2Slug ?? ''}
          className="flex-1 min-w-0 text-xs font-semibold text-stone-800 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
        >
          {teams.map((team) => (
            <option key={team.teamId} value={team.slug}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <select
          name="tipo"
          defaultValue={statType}
          className="flex-1 min-w-0 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <option value="punti">Punti (classifica)</option>
          <option value="fantapunti">Fantapunti (di giornata)</option>
        </select>
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 transition-colors disabled:opacity-70 disabled:cursor-wait"
        >
          {isPending && <LoaderCircle size={13} aria-hidden className="animate-spin" />}
          {isPending ? 'Aggiorno…' : 'Aggiorna'}
        </button>
      </div>
    </form>
  );
}
