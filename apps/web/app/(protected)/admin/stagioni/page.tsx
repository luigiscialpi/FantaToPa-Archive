// apps/web/app/(protected)/admin/stagioni/page.tsx
//
// Sezione admin "Stagioni": creare una nuova annata (es. una manuale come
// 2008-09) e vedere a colpo d'occhio quali hanno la classifica Campionato
// incompleta, prima di aprirle una per una in /admin/stagioni/[slug].
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/server';
import { getSeasonsAdminOverview } from '../../../../lib/queries/admin-seasons';
import { createSeasonAction } from '../../../../lib/admin/season-actions';
import { AdminNav } from '../../../../components/admin/AdminNav';

export const metadata: Metadata = { title: 'Admin · Stagioni' };

export default async function AdminStagioniPage() {
  const supabase = await createClient();
  const seasons = await getSeasonsAdminOverview(supabase);

  return (
    <main className="p-4 space-y-4 max-w-3xl mx-auto">
      <h1 className="font-serif font-bold text-lg text-brand-950">Stagioni</h1>
      <AdminNav />

      <div className="bg-white rounded-lg border border-stone-200 p-4 space-y-3">
        <h2 className="font-semibold text-stone-800 text-sm">Crea nuova stagione</h2>
        <form action={createSeasonAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col text-xs text-stone-500 gap-1">
            Slug (es. "2008-09")
            <input name="slug" required placeholder="2008-09" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
          </label>
          <label className="flex flex-col text-xs text-stone-500 gap-1">
            Etichetta (es. "Stagione 2008/2009")
            <input name="label" required placeholder="Stagione 2008/2009" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
          </label>
          <label className="flex flex-col text-xs text-stone-500 gap-1">
            Inizio (opzionale)
            <input type="date" name="startsOn" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
          </label>
          <label className="flex flex-col text-xs text-stone-500 gap-1">
            Fine (opzionale)
            <input type="date" name="endsOn" className="rounded border border-stone-300 text-sm px-2 py-1.5" />
          </label>
          <button
            type="submit"
            className="sm:col-span-2 rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5 justify-self-start"
          >
            Crea stagione
          </button>
        </form>
        <p className="text-xs text-stone-400">
          Viene creata anche la competizione "Campionato" di default — la classifica si completa dalla pagina della
          stagione qui sotto.
        </p>
      </div>

      <ul className="space-y-2">
        {seasons.map((season) => (
          <li key={season.id} className="bg-white rounded-lg border border-stone-200 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-stone-800 truncate">{season.label}</p>
              <p className="text-xs text-stone-400">
                {season.slug} · {season.campionatoStandingsCount} squadr{season.campionatoStandingsCount === 1 ? 'a' : 'e'} in classifica
                {!season.hasSchedule && ' · senza calendario reale'}
              </p>
            </div>
            <Link
              href={`/admin/stagioni/${season.slug}`}
              className="shrink-0 rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5"
            >
              Gestisci
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
