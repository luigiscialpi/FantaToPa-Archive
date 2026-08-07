// packages/ingestion/scripts/backfill-giornata38-2014-15.ts
//
// La fonte 2014-15 (docs/fantatopa/calendario.html) elenca gli accoppiamenti
// della 38ª giornata ma senza risultato (nessuno span "point"/colonna
// "result": l'admin della lega non finalizzò mai quella giornata sulla
// piattaforma originale, a differenza delle altre 37). La classifica finale
// (da docs/classifiche.md, già in `standings`) riflette però il campionato
// completo. Risultati derivati sottraendo il cumulato delle 37 giornate già
// importate dalla classifica finale, per ciascuna squadra — verificato: ogni
// coppia ha pt_home+pt_away coerente (3 o 2 per un pareggio) e i gol
// fatti/subiti di un lato combaciano esattamente con quelli subiti/fatti
// dell'altro (nessuna quadratura forzata, solo aritmetica). Vedi
// legacy-seasons-compat.md per il dettaglio dell'indagine.
//
// Nota: 3 righe spurie della giornata 1 (formazioni con pairing diverso dal
// calendario ufficiale, risultato/gol null) sono state escluse dal cumulato
// — bug preesistente e distinto, non toccato qui.
//
// Niente lineup_players per questa giornata (nessuna fonte disponibile,
// accettato esplicitamente): solo il livello calendario/classifica, che è
// quanto serve al filtro giornate della pagina Classifica.
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/backfill-giornata38-2014-15.ts
import { createIngestionClient } from '../lib/supabase-client.js';
import { SupabaseSeasonRepository } from '../loader/supabase-season-repository.js';
import type { CalendarImport } from '../schema/imports.js';

const MATCHES: CalendarImport['matchdays'][number]['matches'] = [
  { homeTeamName: 'Biancoceleste Athletic Club', awayTeamName: 'Prozalpi S.F.', homeScore: 73.5, awayScore: 70.5, homeGoals: 2, awayGoals: 1, homeResultPoints: 3, awayResultPoints: 0 },
  { homeTeamName: 'FC Steaua Ste', awayTeamName: 'Carloparola Fc', homeScore: 77.5, awayScore: 60, homeGoals: 2, awayGoals: 2, homeResultPoints: 1, awayResultPoints: 1 },
  { homeTeamName: 'Real Cocu 2003 Fc', awayTeamName: 'Panothinaikos', homeScore: 79.5, awayScore: 57.5, homeGoals: 3, awayGoals: 0, homeResultPoints: 3, awayResultPoints: 0 },
  { homeTeamName: 'Uber Alles Fussball Club', awayTeamName: 'Nemesis FC', homeScore: 87, awayScore: 65.5, homeGoals: 4, awayGoals: 0, homeResultPoints: 3, awayResultPoints: 0 },
  { homeTeamName: 'MR EKO - C&W F.C.', awayTeamName: 'pierpaologranata', homeScore: 74.5, awayScore: 69.5, homeGoals: 2, awayGoals: 1, homeResultPoints: 3, awayResultPoints: 0 },
];

async function main(): Promise<void> {
  const client = createIngestionClient();
  const repo = new SupabaseSeasonRepository(client);

  await repo.upsertCalendar({
    seasonSlug: '2014-15',
    competitionSlug: 'campionato',
    matchdays: [{ number: 38, matches: MATCHES }],
  });

  console.log('Giornata 38 (2014-15) creata: 5 partite derivate dalla classifica finale.');
}

main().catch((err: unknown) => {
  console.error('Backfill giornata 38 (2014-15) fallito:', err);
  process.exit(1);
});
