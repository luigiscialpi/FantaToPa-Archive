// packages/ingestion/scripts/import-historical-seasons.ts
//
// Import per le stagioni 2004-05 → 2012-13: precedono il primo mirror HTML
// disponibile (2013-14), quindi non esiste alcun file sorgente della lega.
// L'unica fonte è una nota storica testuale fornita dall'utente (podio
// Campionato + vincitore Coppa Lelle, nata solo dal 2012-13). Niente
// calendario/formazioni/rose per queste stagioni: restano fuori dal
// selettore stagione in header e dalla galleria stagioni cliccabile in home
// (vedi `hasSchedule` in `apps/web/lib/queries/seasons.ts`), ma restano
// disponibili per Albo d'oro/statistiche storiche.
//
// Identità squadra confermate dall'utente (non decise dal parser):
//   - Igli Tare (2004-05) = Biancoceleste Athletic Club (nota utente "ex Igli Tare").
//   - Skajahnni/Skajahnny/Skajanny = MR EKO - C&W F.C. (alias già in team-registry.local.json).
//   - Nemesis 08 (2008-09) = Nemesis FC (stesso proprietario, confermato).
//   - Igino (solo 2005-06), Naes (2008-09/2009-10), Pier 92 (solo 2010-11) e
//     AC Smokingbianco (2011-12/2012-13) sono squadre a sé, mai più tornate
//     in lega: create qui, non presenti in nessun'altra stagione importata.
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-historical-seasons.ts
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import type { StandingsImport } from '../schema/imports.js';
import { ensureCompetitions, ensureLookups, ensureSeason } from './import-season.js';

type HistoricalSeason = {
  slug: string;
  label: string;
  startsOn: string;
  endsOn: string;
  standings: StandingsImport['rows'];
  /** Vincitore Coppa Lelle: la coppa nasce solo dal 2012-13 (nota utente). */
  coppaLelleWinner?: string;
};

// Nuove squadre confermate dall'utente, mai viste in nessuna stagione già
// importata: create una volta sola, poi referenziate per nome nelle
// standings sotto.
const NEW_TEAMS: { name: string; aliases?: string[] }[] = [
  { name: 'Igino' },
  { name: 'Naes' },
  { name: 'Pier 92' },
  { name: 'AC Smokingbianco', aliases: ['AC Smokingbiancoleite', 'Smokingbianco'] },
];

const SEASONS: HistoricalSeason[] = [
  {
    slug: '2004-05',
    label: 'Stagione 2004/2005',
    startsOn: '2004-08-01',
    endsOn: '2005-06-30',
    // Fusione delle due leghe precedenti: Skajahnni, Real Cocu, Steaua Ste, Igli Tare.
    standings: [{ teamName: 'FC Steaua Ste', position: 1 }],
  },
  {
    slug: '2005-06',
    label: 'Stagione 2005/2006',
    startsOn: '2005-08-01',
    endsOn: '2006-06-30',
    standings: [
      { teamName: 'Real Cocu 2003 Fc', position: 1 },
      { teamName: 'Igino', position: 2 },
    ],
  },
  {
    slug: '2006-07',
    label: 'Stagione 2006/2007',
    startsOn: '2006-08-01',
    endsOn: '2007-06-30',
    standings: [{ teamName: 'Goliardic F.C.', position: 1 }],
  },
  {
    slug: '2007-08',
    label: 'Stagione 2007/2008',
    startsOn: '2007-08-01',
    endsOn: '2008-06-30',
    standings: [{ teamName: 'Prozalpi S.F.', position: 1 }],
  },
  {
    slug: '2008-09',
    label: 'Stagione 2008/2009',
    startsOn: '2008-08-01',
    endsOn: '2009-06-30',
    // Lega a 8 squadre: entrano Naes e Nemesis 08 (= Nemesis FC).
    standings: [{ teamName: 'MR EKO - C&W F.C.', position: 1 }],
  },
  {
    slug: '2009-10',
    label: 'Stagione 2009/2010',
    startsOn: '2009-08-01',
    endsOn: '2010-06-30',
    // Fallimento di Naes, entra CarloParola.
    standings: [{ teamName: 'MR EKO - C&W F.C.', position: 1 }],
  },
  {
    slug: '2010-11',
    label: 'Stagione 2010/2011',
    startsOn: '2010-08-01',
    endsOn: '2011-06-30',
    // Lega a 10 squadre: entrano Pier 92 e pierpaologranata.
    standings: [
      { teamName: 'Prozalpi S.F.', position: 1 },
      { teamName: 'pierpaologranata', position: 2 },
    ],
  },
  {
    slug: '2011-12',
    label: 'Stagione 2011/2012',
    startsOn: '2011-08-01',
    endsOn: '2012-06-30',
    // Pier 92 esclusa per fair play finanziario, sostituita da AC Smokingbianco.
    standings: [
      { teamName: 'Prozalpi S.F.', position: 1 },
      { teamName: 'pierpaologranata', position: 2 },
    ],
  },
  {
    slug: '2012-13',
    label: 'Stagione 2012/2013',
    startsOn: '2012-08-01',
    endsOn: '2013-06-30',
    standings: [
      { teamName: 'pierpaologranata', position: 1 },
      { teamName: 'MR EKO - C&W F.C.', position: 2 },
      { teamName: 'AC Smokingbianco', position: 3 },
    ],
    // Prima edizione della Coppa Lelle: finale ai rigori, Real Cocu batte Goliardic F.C.
    coppaLelleWinner: 'Real Cocu 2003 Fc',
  },
];

async function main(): Promise<void> {
  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);

  await ensureLookups(client);
  await repo.upsertTeams(NEW_TEAMS);
  console.log(`Squadre storiche create: ${NEW_TEAMS.map((t) => t.name).join(', ')}`);

  for (const season of SEASONS) {
    const seasonId = await ensureSeason(client, season);
    await ensureCompetitions(
      client,
      seasonId,
      season.coppaLelleWinner ? { coppa: { faseFinale: { folder: 'manuale' } } } : {},
    );

    await repo.upsertStandings({ seasonSlug: season.slug, competitionSlug: 'campionato', rows: season.standings });

    if (season.coppaLelleWinner) {
      await repo.upsertStandings({
        seasonSlug: season.slug,
        competitionSlug: 'coppa-fase-finale',
        rows: [{ teamName: season.coppaLelleWinner, position: 1 }],
      });
    }

    const podium = season.standings.map((row) => `${row.position}\u00b0 ${row.teamName}`).join(', ');
    const coppa = season.coppaLelleWinner ? `, Coppa Lelle vinta da ${season.coppaLelleWinner}` : '';
    console.log(`${season.slug}: podio importato (${podium})${coppa}`);
  }

  console.log('\nImport stagioni storiche 2004-05 \u2192 2012-13 completato.');
}

main().catch((err: unknown) => {
  console.error('Import stagioni storiche fallito:', err);
  process.exit(1);
});
