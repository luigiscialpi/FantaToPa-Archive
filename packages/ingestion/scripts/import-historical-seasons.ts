// packages/ingestion/scripts/import-historical-seasons.ts
//
// Import per le stagioni 2004-05 → 2012-13: precedono il primo mirror HTML
// disponibile (2013-14), quindi non esiste alcun file sorgente della lega.
// Per 2004-05, 2011-12 e 2012-13 l'unica fonte è una nota storica testuale
// (solo podio Campionato + vincitore Coppa Lelle, nata dal 2012-13). Per
// 2005-06→2010-11 la fonte è invece la classifica finale completa in
// `docs/classifiche.md` (posizione/punti/gol fatti-subiti, V/N/P dove noti
// nella fonte — colonna "…" = non riportata, mai importata come zero).
// Niente calendario/formazioni/rose per queste stagioni: restano fuori dal
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
    // Classifica finale completa da docs/classifiche.md (nessuna colonna V/N/P in questa tabella).
    standings: [
      { teamName: 'Real Cocu 2003 Fc', position: 1, points: 63, goalsFor: 61, goalsAgainst: 55 },
      { teamName: 'Igino', position: 2, points: 57, goalsFor: 61, goalsAgainst: 47 },
      { teamName: 'Biancoceleste Athletic Club', position: 3, points: 53, goalsFor: 52, goalsAgainst: 50 },
      { teamName: 'Prozalpi S.F.', position: 4, points: 50, goalsFor: 54, goalsAgainst: 61 },
      { teamName: 'FC Steaua Ste', position: 5, points: 46, goalsFor: 55, goalsAgainst: 56 },
      { teamName: 'MR EKO - C&W F.C.', position: 6, points: 43, goalsFor: 45, goalsAgainst: 58 },
    ],
  },
  {
    slug: '2006-07',
    label: 'Stagione 2006/2007',
    startsOn: '2006-08-01',
    endsOn: '2007-06-30',
    // Classifica finale completa da docs/classifiche.md; "lost" assente per le
    // posizioni 4-6 (colonna PE = "…" nella fonte, non zero sconfitte).
    standings: [
      { teamName: 'Goliardic F.C.', position: 1, points: 59, goalsFor: 70, goalsAgainst: 59, won: 17, drawn: 8, lost: 13 },
      { teamName: 'Prozalpi S.F.', position: 2, points: 55, goalsFor: 64, goalsAgainst: 58, won: 15, drawn: 10, lost: 13 },
      { teamName: 'Real Cocu 2003 Fc', position: 3, points: 55, goalsFor: 56, goalsAgainst: 55, won: 15, drawn: 10, lost: 13 },
      { teamName: 'FC Steaua Ste', position: 4, points: 54, goalsFor: 59, goalsAgainst: 61, won: 14, drawn: 12 },
      { teamName: 'Biancoceleste Athletic Club', position: 5, points: 47, goalsFor: 45, goalsAgainst: 54, won: 11, drawn: 14 },
      { teamName: 'MR EKO - C&W F.C.', position: 6, points: 37, goalsFor: 53, goalsAgainst: 60, won: 11, drawn: 7 },
    ],
  },
  {
    slug: '2007-08',
    label: 'Stagione 2007/2008',
    startsOn: '2007-08-01',
    endsOn: '2008-06-30',
    // Classifica finale completa da docs/classifiche.md.
    standings: [
      { teamName: 'Prozalpi S.F.', position: 1, points: 65, goalsFor: 64, goalsAgainst: 40, won: 17, drawn: 14, lost: 7 },
      { teamName: 'Real Cocu 2003 Fc', position: 2, points: 57, goalsFor: 74, goalsAgainst: 59, won: 15, drawn: 12, lost: 11 },
      { teamName: 'Biancoceleste Athletic Club', position: 3, points: 53, goalsFor: 59, goalsAgainst: 60, won: 13, drawn: 14, lost: 11 },
      { teamName: 'MR EKO - C&W F.C.', position: 4, points: 52, goalsFor: 48, goalsAgainst: 51, won: 13, drawn: 13, lost: 12 },
      { teamName: 'FC Steaua Ste', position: 5, points: 48, goalsFor: 48, goalsAgainst: 53, won: 13, drawn: 9, lost: 16 },
      { teamName: 'Goliardic F.C.', position: 6, points: 31, goalsFor: 38, goalsAgainst: 67, won: 7, drawn: 10, lost: 21 },
    ],
  },
  {
    slug: '2008-09',
    label: 'Stagione 2008/2009',
    startsOn: '2008-08-01',
    endsOn: '2009-06-30',
    // Lega a 8 squadre: entrano Naes e Nemesis 08 (= Nemesis FC). Classifica
    // finale completa da docs/classifiche.md; "lost" assente per tutte le
    // posizioni (colonna PE = "…" nella fonte per l'intera tabella).
    standings: [
      { teamName: 'MR EKO - C&W F.C.', position: 1, points: 72, goalsFor: 62, goalsAgainst: 44, won: 21, drawn: 9 },
      { teamName: 'FC Steaua Ste', position: 2, points: 69, goalsFor: 50, goalsAgainst: 37, won: 20, drawn: 9 },
      { teamName: 'Real Cocu 2003 Fc', position: 3, points: 58, goalsFor: 57, goalsAgainst: 41, won: 17, drawn: 7 },
      { teamName: 'Goliardic F.C.', position: 4, points: 55, goalsFor: 43, goalsAgainst: 40, won: 14, drawn: 13 },
      { teamName: 'Biancoceleste Athletic Club', position: 5, points: 52, goalsFor: 45, goalsAgainst: 40, won: 14, drawn: 10 },
      { teamName: 'Prozalpi S.F.', position: 6, points: 42, goalsFor: 42, goalsAgainst: 54, won: 10, drawn: 12 },
      { teamName: 'Nemesis FC', position: 7, points: 40, goalsFor: 40, goalsAgainst: 54, won: 10, drawn: 10 },
      { teamName: 'Naes', position: 8, points: 28, goalsFor: 18, goalsAgainst: 47, won: 6, drawn: 10 },
    ],
  },
  {
    slug: '2009-10',
    label: 'Stagione 2009/2010',
    startsOn: '2009-08-01',
    endsOn: '2010-06-30',
    // Fallimento di Naes, entra CarloParola. Classifica finale completa da
    // docs/classifiche.md; "lost" assente per tutte le posizioni (colonna PE
    // = "…" nella fonte per l'intera tabella).
    standings: [
      { teamName: 'MR EKO - C&W F.C.', position: 1, points: 75, goalsFor: 55, goalsAgainst: 36, won: 23, drawn: 6 },
      { teamName: 'Biancoceleste Athletic Club', position: 2, points: 61, goalsFor: 55, goalsAgainst: 53, won: 18, drawn: 7 },
      { teamName: 'Nemesis FC', position: 3, points: 57, goalsFor: 48, goalsAgainst: 41, won: 18, drawn: 3 },
      { teamName: 'Real Cocu 2003 Fc', position: 4, points: 56, goalsFor: 56, goalsAgainst: 46, won: 16, drawn: 8 },
      { teamName: 'Prozalpi S.F.', position: 5, points: 53, goalsFor: 53, goalsAgainst: 51, won: 15, drawn: 8 },
      { teamName: 'FC Steaua Ste', position: 6, points: 48, goalsFor: 46, goalsAgainst: 52, won: 14, drawn: 6 },
      { teamName: 'Carloparola Fc', position: 7, points: 42, goalsFor: 38, goalsAgainst: 53, won: 12, drawn: 6 },
      { teamName: 'Goliardic F.C.', position: 8, points: 36, goalsFor: 40, goalsAgainst: 59, won: 8, drawn: 12 },
    ],
  },
  {
    slug: '2010-11',
    label: 'Stagione 2010/2011',
    startsOn: '2010-08-01',
    endsOn: '2011-06-30',
    // Lega a 10 squadre: entrano Pier 92 e pierpaologranata. Classifica finale
    // completa da docs/classifiche.md — "Piergiorgio" nel doc = Pier 92
    // (confermato dall'utente). "lost" assente dalla posizione 5 in giù
    // (colonna PE = "…" nella fonte).
    standings: [
      { teamName: 'Prozalpi S.F.', position: 1, points: 61, goalsFor: 61, goalsAgainst: 48, won: 17, drawn: 10, lost: 14 },
      { teamName: 'pierpaologranata', position: 2, points: 60, goalsFor: 50, goalsAgainst: 41, won: 16, drawn: 12, lost: 10 },
      { teamName: 'FC Steaua Ste', position: 3, points: 58, goalsFor: 47, goalsAgainst: 38, won: 14, drawn: 16, lost: 8 },
      { teamName: 'Carloparola Fc', position: 4, points: 55, goalsFor: 50, goalsAgainst: 49, won: 16, drawn: 7, lost: 15 },
      { teamName: 'Nemesis FC', position: 5, points: 55, goalsFor: 48, goalsAgainst: 51, won: 16, drawn: 7 },
      { teamName: 'Pier 92', position: 6, points: 53, goalsFor: 56, goalsAgainst: 50, won: 13, drawn: 14 },
      { teamName: 'Biancoceleste Athletic Club', position: 7, points: 50, goalsFor: 51, goalsAgainst: 52, won: 13, drawn: 11 },
      { teamName: 'Goliardic F.C.', position: 8, points: 47, goalsFor: 43, goalsAgainst: 43, won: 10, drawn: 17 },
      { teamName: 'Real Cocu 2003 Fc', position: 9, points: 43, goalsFor: 38, goalsAgainst: 45, won: 11, drawn: 10 },
      { teamName: 'MR EKO - C&W F.C.', position: 10, points: 29, goalsFor: 32, goalsAgainst: 59, won: 5, drawn: 14 },
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
