// packages/ingestion/scripts/import-season-2015-16.ts
//
// Stagione 2015-16: nessun mirror/file sorgente disponibile (buco tra il
// 2014-15 reale e il 2016-17 reale). L'unica fonte è la classifica finale
// completa Campionato in `docs/classifiche.md` ("Classifica Campionato 15/16",
// posizione/punti/gol fatti-subiti/V/N/P/Somma Tot — tutte le colonne sempre
// presenti in questa tabella, nessun "…"). Niente calendario/formazioni/rose:
// stessa situazione delle stagioni storiche 2004-05→2012-13
// (`import-historical-seasons.ts`), qui isolata in un file a parte perché
// 2015-16 non rientra nel periodo "precede il primo mirror HTML" che
// giustifica quello script.
//
// Nomi squadra: la tabella usa gli stessi soprannomi manager di
// "Classifica Finale 2014-2015" (stessa identica lega, 10 squadre). Risolti
// incrociando posizione/punti/Somma Tot con la classifica 2014-15 reale già
// in Supabase (corrispondenza esatta su tutte le 10 righe): Stam = Carloparola
// Fc (stesso manager di "Antonio", nickname cambiato nel tempo), Uccio =
// Nemesis FC (stesso manager di "Salvatore"), Zalpi = Prozalpi S.F. (stesso
// manager di "Luigi" nelle stagioni precedenti).
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/import-season-2015-16.ts
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import type { StandingsImport } from '../schema/imports.js';
import { ensureCompetitions, ensureLookups, ensureSeason } from './import-season.js';

const SEASON = {
  slug: '2015-16',
  label: 'Stagione 2015/2016',
  startsOn: '2015-08-01',
  endsOn: '2016-06-30',
};

const STANDINGS: StandingsImport['rows'] = [
  { teamName: 'Real Cocu 2003 Fc', position: 1, points: 65, goalsFor: 60, goalsAgainst: 52, won: 19, drawn: 8, lost: 11, totalFantapoints: 2740 },
  { teamName: 'Prozalpi S.F.', position: 2, points: 63, goalsFor: 65, goalsAgainst: 51, won: 17, drawn: 12, lost: 9, totalFantapoints: 2774.5 },
  { teamName: 'FC Steaua Ste', position: 3, points: 62, goalsFor: 55, goalsAgainst: 45, won: 18, drawn: 8, lost: 12, totalFantapoints: 2715.5 },
  { teamName: 'Biancoceleste Athletic Club', position: 4, points: 56, goalsFor: 61, goalsAgainst: 45, won: 16, drawn: 8, lost: 14, totalFantapoints: 2729.5 },
  { teamName: 'Carloparola Fc', position: 5, points: 55, goalsFor: 57, goalsAgainst: 55, won: 15, drawn: 10, lost: 13, totalFantapoints: 2706 },
  { teamName: 'MR EKO - C&W F.C.', position: 6, points: 50, goalsFor: 49, goalsAgainst: 50, won: 12, drawn: 14, lost: 12, totalFantapoints: 2675.5 },
  { teamName: 'Panothinaikos', position: 7, points: 47, goalsFor: 57, goalsAgainst: 63, won: 12, drawn: 11, lost: 15, totalFantapoints: 2715 },
  { teamName: 'Nemesis FC', position: 8, points: 46, goalsFor: 58, goalsAgainst: 66, won: 11, drawn: 13, lost: 14, totalFantapoints: 2721.5 },
  { teamName: 'pierpaologranata', position: 9, points: 41, goalsFor: 40, goalsAgainst: 49, won: 11, drawn: 8, lost: 19, totalFantapoints: 2631.5 },
  { teamName: 'Uber Alles Fussball Club', position: 10, points: 33, goalsFor: 33, goalsAgainst: 59, won: 7, drawn: 12, lost: 19, totalFantapoints: 2537.5 },
];

const COPPA_STANDINGS: StandingsImport['rows'] = [
  { teamName: 'Nemesis FC', position: 1 },
];

async function main(): Promise<void> {
  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);

  await ensureLookups(client);
  const seasonId = await ensureSeason(client, SEASON);
  await ensureCompetitions(client, seasonId, { coppa: { faseFinale: { folder: 'manuale' } } });

  await repo.upsertStandings({ seasonSlug: SEASON.slug, competitionSlug: 'campionato', rows: STANDINGS });
  await repo.upsertStandings({ seasonSlug: SEASON.slug, competitionSlug: 'coppa-fase-finale', rows: COPPA_STANDINGS });

  console.log(`${SEASON.slug}: classifica completa importata (${STANDINGS.length} squadre). Coppa Lelle vinta da Nemesis FC.`);
}

main().catch((err: unknown) => {
  console.error('Import 2015-16 fallito:', err);
  process.exit(1);
});
