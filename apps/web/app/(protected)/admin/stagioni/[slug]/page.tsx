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
import { getSeasons, getCompetitions } from '../../../../../lib/queries/seasons';
import { getStandings } from '../../../../../lib/queries/classifica';
import { getAllTeams } from '../../../../../lib/queries/teams';
import { addStandingsRowAction } from '../../../../../lib/admin/season-actions';
import { AdminNav } from '../../../../../components/admin/AdminNav';
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

  const seasons = await getSeasons(supabase);
  const season = seasons.find((candidate) => candidate.slug === slug);
  if (!season) {
    notFound();
  }

  const [competitions, teams] = await Promise.all([getCompetitions(supabase, season.id), getAllTeams(supabase)]);
  const campionato = competitions.find((competition) => competition.kindCode === 'campionato');
  if (!campionato) {
    notFound();
  }

  const standings = await getStandings(supabase, campionato.id, season.id);
  const teamIdsInStandings = new Set(standings.map((row) => row.teamId));
  const availableTeams = teams.filter((team) => !teamIdsInStandings.has(team.id));

  return (
    <main className="p-4 space-y-4 max-w-3xl mx-auto">
      <h1 className="font-serif font-bold text-lg text-brand-950">{season.label}</h1>
      <AdminNav />

      <Link href="/admin/stagioni" className="text-sm text-brand-700 font-semibold">
        ← Tutte le stagioni
      </Link>

      <section className="space-y-2">
        <h2 className="font-semibold text-stone-800 text-sm">Classifica Campionato</h2>
        <ClassificaTable rows={standings} seasonSlug={season.slug} editMode />
      </section>

      <section className="bg-white rounded-lg border border-stone-200 p-4 space-y-3">
        <h2 className="font-semibold text-stone-800 text-sm">Aggiungi squadra alla classifica</h2>
        <form action={addStandingsRowAction.bind(null, campionato.id)} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {availableTeams.length > 0 && (
            <label className="col-span-2 sm:col-span-4 flex flex-col text-xs text-stone-500 gap-1">
              Squadra esistente
              <select name="teamId" className="rounded border border-stone-300 text-sm px-2 py-1.5">
                <option value="">Seleziona…</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="col-span-2 sm:col-span-4 flex flex-col text-xs text-stone-500 gap-1">
            Oppure nuova squadra (mai vista in nessuna stagione, es. un club che partecipò solo qui)
            <input
              type="text"
              name="newTeamName"
              placeholder="Nome squadra"
              className="rounded border border-stone-300 text-sm px-2 py-1.5"
            />
          </label>
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
            <input type="number" step="0.5" name="totalFantapoints" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
          </label>
          <button
            type="submit"
            className="col-span-2 sm:col-span-4 rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5 justify-self-start"
          >
            Aggiungi
          </button>
        </form>
        <p className="text-xs text-stone-400">
          Compilando "nuova squadra" quella ha la precedenza sulla squadra esistente selezionata. Solo la posizione
          basta per un podio manuale (come le stagioni storiche 2004-05→2012-13) — gli altri campi restano vuoti
          finché non si conoscono.
        </p>
      </section>
    </main>
  );
}
