// packages/ingestion/scripts/cleanup-giornata1-phantom-matches-2014-15.ts
//
// La giornata 1 (2014-15) aveva 8 righe in `matches` invece di 5: 3 sono
// "fantasma", con `lineups` collegate ma `home_result_points`/`home_goals`
// NULL (nessun risultato calendario) e un accoppiamento che non esiste nel
// calendario ufficiale di giornata 1. Causa confermata (utente + verifica
// incrociata): il file sorgente col vero `gselected=1`
// (`formazioni_1e449b2b.html`) ha renderizzato in parte contenuto
// "leaked"/duplicato della giornata 22 — coerente con il glitch già noto di
// quella stessa pagina (lo span "LabelGiornata" della fonte diceva "1ª
// GIORNATA COMPETIZIONE - 22ª SERIE A", vedi commento in lineup.ts). La
// giornata 22 ha già le proprie 5 partite corrette e complete (file
// `formazioni_6be40742.html`, gselected=22) — queste 3 righe non aggiungono
// nulla, sono solo rumore duplicato da rimuovere dalla giornata 1.
// NON tocca la 4ª partita del file (CarloParola-MR EKO), che combacia
// esattamente col calendario reale di giornata 1 ed è corretta.
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/cleanup-giornata1-phantom-matches-2014-15.ts
import { createIngestionClient } from '../lib/supabase-client.js';

async function main(): Promise<void> {
  const client = createIngestionClient();

  const { data: season } = await client.from('seasons').select('id').eq('slug', '2014-15').single();
  if (!season) throw new Error('Stagione 2014-15 non trovata');
  const { data: competition } = await client
    .from('competitions')
    .select('id')
    .eq('season_id', season.id)
    .eq('slug', 'campionato')
    .single();
  if (!competition) throw new Error('Competizione campionato non trovata');
  const { data: matchday1 } = await client
    .from('matchdays')
    .select('id')
    .eq('competition_id', competition.id)
    .eq('number', 1)
    .single();
  if (!matchday1) throw new Error('Giornata 1 non trovata');

  const { data: phantomMatches, error: selectError } = await client
    .from('matches')
    .select('id, home_team_id, away_team_id')
    .eq('matchday_id', matchday1.id)
    .is('home_result_points', null);
  if (selectError) throw selectError;
  if (!phantomMatches || phantomMatches.length !== 3) {
    throw new Error(
      `Attese esattamente 3 partite fantasma (risultato NULL) in giornata 1, trovate ${phantomMatches?.length ?? 0}. Interrompo senza cancellare nulla.`,
    );
  }

  const matchIds = phantomMatches.map((m) => m.id);
  console.log(`Partite fantasma trovate: ${matchIds.length}`, matchIds);

  const { data: lineupsToDelete } = await client.from('lineups').select('id').in('match_id', matchIds);
  console.log(`Lineups collegate da eliminare: ${lineupsToDelete?.length ?? 0}`);

  // lineup_players ha "on delete cascade" su lineup_id: basta cancellare lineups.
  const { error: deleteLineupsError } = await client.from('lineups').delete().in('match_id', matchIds);
  if (deleteLineupsError) throw new Error(`Errore cancellazione lineups: ${deleteLineupsError.message}`);

  const { error: deleteMatchesError } = await client.from('matches').delete().in('id', matchIds);
  if (deleteMatchesError) throw new Error(`Errore cancellazione matches: ${deleteMatchesError.message}`);

  console.log('Pulizia completata: giornata 1 (2014-15) ora ha solo le sue 5 partite reali.');
}

main().catch((err: unknown) => {
  console.error('Pulizia giornata 1 (2014-15) fallita:', err);
  process.exit(1);
});
