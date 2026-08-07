// apps/web/app/(protected)/admin/stagioni/[slug]/page.tsx
//
// Dettaglio di una stagione lato admin: completare la classifica
// Campionato aggiungendo le squadre ancora mancanti (una squadra esistente
// o una del tutto nuova, mai vista in nessuna stagione — es. 2008-09,
// creata con solo il podio) e modificare le righe già presenti —
// quest'ultimo riusa ClassificaTable/ClassificaRow in editMode così com'è
// (updateStandingsRowAction, classifica-actions.ts), stesso componente
// della pagina pubblica /stagioni/[season]/classifica.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '../../../../../lib/supabase/server';
import { getCompetitions } from '../../../../../lib/queries/seasons';
import { getKnownTeamOwners, getSeasonsAdminOverview } from '../../../../../lib/queries/admin-seasons';
import { getStandings, type StandingsRow } from '../../../../../lib/queries/classifica';
import { getMatchdayOptions, type MatchdayOption } from '../../../../../lib/queries/formazioni';
import { getAllTeams } from '../../../../../lib/queries/teams';
import {
  addCoppaCompetitionAction,
  addMatchdayAction,
  addStandingsRowAction,
  updateSeasonAction,
} from '../../../../../lib/admin/season-actions';
import { AdminNav } from '../../../../../components/admin/AdminNav';
import { DeleteSeasonButton } from '../../../../../components/admin/DeleteSeasonButton';
import { OwnerAndTeamFields } from '../../../../../components/admin/OwnerAndTeamFields';
import { SubmitButton } from '../../../../../components/shared/SubmitButton';
import { SaveButton } from '../../../../../components/shared/SaveButton';
import { ClassificaTable } from '../../../../../components/classifica/ClassificaTable';

type AdminStagionePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: AdminStagionePageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Admin · Stagione ${slug}` };
}

export default async function AdminStagionePage({ params }: AdminStagionePageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const seasons = await getSeasonsAdminOverview(supabase);
  const season = seasons.find((candidate) => candidate.slug === slug);
  if (!season) {
    notFound();
  }

  const [competitions, teams] = await Promise.all([getCompetitions(supabase, season.id), getAllTeams(supabase)]);
  const campionato = competitions.find((competition) => competition.kindCode === 'campionato');
  if (!campionato) {
    notFound();
  }
  const coppa = competitions.find((competition) => competition.slug === 'coppa-fase-finale');
  const otherCompetitions = competitions.filter(
    (competition) => competition.id !== campionato.id && competition.id !== coppa?.id,
  );

  const knownOwners = await getKnownTeamOwners(supabase);

  const [standings, campionatoMatchdays] = await Promise.all([
    getStandings(supabase, campionato.id, season.id),
    getMatchdayOptions(supabase, campionato.id),
  ]);
  const teamIdsInStandings = new Set(standings.map((row) => row.teamId));
  const availableTeams = teams.filter((team) => !teamIdsInStandings.has(team.id));

  const [coppaStandings, coppaMatchdays]: [StandingsRow[], MatchdayOption[]] = coppa
    ? await Promise.all([getStandings(supabase, coppa.id, season.id), getMatchdayOptions(supabase, coppa.id)])
    : [[], []];
  const teamIdsInCoppaStandings = new Set(coppaStandings.map((row) => row.teamId));
  const availableTeamsForCoppa = teams.filter((team) => !teamIdsInCoppaStandings.has(team.id));

  const otherMatchdaysByCompetition = await Promise.all(
    otherCompetitions.map(async (competition) => ({
      competition,
      matchdays: await getMatchdayOptions(supabase, competition.id),
    })),
  );

  return (
    <main className="p-4 space-y-4 max-w-3xl mx-auto">
      <h1 className="font-serif font-bold text-lg text-brand-950">{season.label}</h1>
      <AdminNav />

      <Link href="/admin/stagioni" className="text-sm text-brand-700 font-semibold">
        ← Tutte le stagioni
      </Link>

      <section className="bg-white rounded-lg border border-stone-200 p-4 space-y-3">
        <h2 className="font-semibold text-stone-800 text-sm">Modifica stagione</h2>
        <form
          id="edit-season"
          action={updateSeasonAction.bind(null, season.id)}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <label className="flex flex-col text-xs text-stone-500 gap-1">
            Etichetta
            <input
              name="label"
              required
              defaultValue={season.label}
              className="rounded border border-stone-300 text-sm px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col text-xs text-stone-500 gap-1">
            Inizio (obbligatoria, serve per ordinare le stagioni)
            <input
              type="date"
              name="startsOn"
              required
              defaultValue={season.startsOn ?? ''}
              className="rounded border border-stone-300 text-sm px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col text-xs text-stone-500 gap-1">
            Fine (opzionale)
            <input
              type="date"
              name="endsOn"
              defaultValue={season.endsOn ?? ''}
              className="rounded border border-stone-300 text-sm px-2 py-1.5"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" name="isCompleted" defaultChecked={season.endsOn !== null} />
            Stagione conclusa (anche con dati mancanti/data di fine ignota)
          </label>
          <SaveButton
            formId="edit-season"
            resetKey={JSON.stringify({ label: season.label, startsOn: season.startsOn, endsOn: season.endsOn })}
            pendingLabel="Salvo…"
            className="sm:col-span-2 rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5 justify-self-start disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Salva
          </SaveButton>
        </form>
      </section>

      <details open className="bg-white rounded-lg border border-stone-200 group">
        <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-stone-800 text-sm list-none flex items-center gap-2">
          <span className="text-stone-400 group-open:rotate-90 transition-transform">▶</span>
          Campionato
        </summary>
        <div className="px-4 pb-4 space-y-4">
          <div className="border border-stone-200 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-stone-800">
              Giornate{' '}
              <span className="text-xs font-normal text-stone-400">
                ({campionatoMatchdays.length} giornat{campionatoMatchdays.length === 1 ? 'a' : 'e'})
              </span>
            </p>
            <form action={addMatchdayAction.bind(null, campionato.id)} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col text-xs text-stone-500 gap-1">
                Numero
                <input
                  type="number"
                  name="number"
                  min={1}
                  required
                  className="w-20 rounded border border-stone-300 text-sm px-2 py-1.5"
                />
              </label>
              <label className="flex flex-col text-xs text-stone-500 gap-1">
                Etichetta (opzionale)
                <input type="text" name="label" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
              </label>
              <SubmitButton
                pendingLabel="Aggiungo…"
                className="rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5 disabled:opacity-60"
              >
                Aggiungi giornata
              </SubmitButton>
            </form>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-stone-800 text-sm">Classifica</h3>
            <ClassificaTable rows={standings} seasonSlug={season.slug} editMode />
          </div>

          <div className="border border-stone-200 rounded-lg p-3 space-y-3">
            <h3 className="font-semibold text-stone-800 text-sm">Aggiungi squadra alla classifica</h3>
            <form
              action={addStandingsRowAction.bind(null, season.id, campionato.id)}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              <OwnerAndTeamFields knownOwners={knownOwners} availableTeams={availableTeams} />
              <label className="flex flex-col text-xs text-stone-500 gap-1">
                Posizione
                <input type="number" name="position" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
              </label>
              <label className="flex flex-col text-xs text-stone-500 gap-1">
                Punti
                <input type="number" name="points" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
              </label>
              <label className="flex flex-col text-xs text-stone-500 gap-1">
                G
                <input type="number" name="played" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
              </label>
              <label className="flex flex-col text-xs text-stone-500 gap-1">
                V
                <input type="number" name="won" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
              </label>
              <label className="flex flex-col text-xs text-stone-500 gap-1">
                N
                <input type="number" name="drawn" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
              </label>
              <label className="flex flex-col text-xs text-stone-500 gap-1">
                P
                <input type="number" name="lost" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
              </label>
              <label className="flex flex-col text-xs text-stone-500 gap-1">
                Gol fatti
                <input type="number" name="goalsFor" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
              </label>
              <label className="flex flex-col text-xs text-stone-500 gap-1">
                Gol subiti
                <input type="number" name="goalsAgainst" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
              </label>
              <label className="flex flex-col text-xs text-stone-500 gap-1">
                Fantapunti tot.
                <input
                  type="number"
                  step="0.5"
                  name="totalFantapoints"
                  className="rounded border border-stone-300 text-sm px-2 py-1.5"
                />
              </label>
              <SubmitButton
                pendingLabel="Aggiungo…"
                className="col-span-2 sm:col-span-4 rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5 justify-self-start disabled:opacity-60"
              >
                Aggiungi
              </SubmitButton>
            </form>
            <p className="text-xs text-stone-400">
              Solo la posizione basta per un podio manuale (come le stagioni storiche 2004-05→2012-13) — gli altri
              campi restano vuoti finché non si conoscono.
            </p>
          </div>
        </div>
      </details>

      <details className="bg-white rounded-lg border border-stone-200 group">
        <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-stone-800 text-sm list-none flex items-center gap-2">
          <span className="text-stone-400 group-open:rotate-90 transition-transform">▶</span>
          Coppa
        </summary>
        <div className="px-4 pb-4 space-y-4">
          {!coppa ? (
            <form action={addCoppaCompetitionAction.bind(null, season.id)}>
              <SubmitButton
                pendingLabel="Creo…"
                className="rounded-lg bg-stone-200 text-stone-700 text-sm font-semibold px-3 py-1.5 disabled:opacity-60"
              >
                + Crea Coppa (fase finale)
              </SubmitButton>
            </form>
          ) : (
            <>
              <div className="border border-stone-200 rounded-lg p-3 space-y-2">
                <p className="text-sm font-semibold text-stone-800">
                  Giornate{' '}
                  <span className="text-xs font-normal text-stone-400">
                    ({coppaMatchdays.length} giornat{coppaMatchdays.length === 1 ? 'a' : 'e'})
                  </span>
                </p>
                <form action={addMatchdayAction.bind(null, coppa.id)} className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col text-xs text-stone-500 gap-1">
                    Numero
                    <input
                      type="number"
                      name="number"
                      min={1}
                      required
                      className="w-20 rounded border border-stone-300 text-sm px-2 py-1.5"
                    />
                  </label>
                  <label className="flex flex-col text-xs text-stone-500 gap-1">
                    Etichetta (opzionale)
                    <input type="text" name="label" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
                  </label>
                  <SubmitButton
                    pendingLabel="Aggiungo…"
                    className="rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5 disabled:opacity-60"
                  >
                    Aggiungi giornata
                  </SubmitButton>
                </form>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-stone-800 text-sm">Classifica</h3>
                <ClassificaTable rows={coppaStandings} seasonSlug={season.slug} editMode />
              </div>

              <div className="border border-stone-200 rounded-lg p-3 space-y-3">
                <h3 className="font-semibold text-stone-800 text-sm">Aggiungi vincitore Coppa</h3>
                <form
                  action={addStandingsRowAction.bind(null, season.id, coppa.id)}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-3"
                >
                  {/* eliminazione diretta: nessuna statistica G/V/N/P/Gf/Gs, solo chi ha vinto (posizione 1) */}
                  <input type="hidden" name="position" value="1" />
                  <OwnerAndTeamFields knownOwners={knownOwners} availableTeams={availableTeamsForCoppa} />
                  <SubmitButton
                    pendingLabel="Aggiungo…"
                    className="col-span-2 sm:col-span-4 rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5 justify-self-start disabled:opacity-60"
                  >
                    Aggiungi vincitore
                  </SubmitButton>
                </form>
              </div>
            </>
          )}
        </div>
      </details>

      {otherMatchdaysByCompetition.length > 0 && (
        <details className="bg-white rounded-lg border border-stone-200 group">
          <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-stone-800 text-sm list-none flex items-center gap-2">
            <span className="text-stone-400 group-open:rotate-90 transition-transform">▶</span>
            Altre competizioni
          </summary>
          <ul className="px-4 pb-4 space-y-3">
            {otherMatchdaysByCompetition.map(({ competition, matchdays }) => (
              <li key={competition.id} className="border border-stone-200 rounded-lg p-3 space-y-2">
                <p className="text-sm font-semibold text-stone-800">
                  {competition.name}{' '}
                  <span className="text-xs font-normal text-stone-400">
                    ({matchdays.length} giornat{matchdays.length === 1 ? 'a' : 'e'})
                  </span>
                </p>
                <form action={addMatchdayAction.bind(null, competition.id)} className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col text-xs text-stone-500 gap-1">
                    Numero
                    <input
                      type="number"
                      name="number"
                      min={1}
                      required
                      className="w-20 rounded border border-stone-300 text-sm px-2 py-1.5"
                    />
                  </label>
                  <label className="flex flex-col text-xs text-stone-500 gap-1">
                    Etichetta (opzionale)
                    <input type="text" name="label" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
                  </label>
                  <SubmitButton
                    pendingLabel="Aggiungo…"
                    className="rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5 disabled:opacity-60"
                  >
                    Aggiungi giornata
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="bg-white rounded-lg border border-red-200 p-4 flex items-center justify-between gap-3">
        <p className="text-sm text-stone-600">Elimina questa stagione e tutti i dati collegati (classifica, calendario, rose, formazioni).</p>
        <DeleteSeasonButton seasonId={season.id} seasonLabel={season.label} />
      </section>
    </main>
  );
}
