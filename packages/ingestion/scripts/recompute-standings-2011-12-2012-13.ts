// packages/ingestion/scripts/recompute-standings-2011-12-2012-13.ts
//
// Regressione introdotta in questa stessa sessione: ri-eseguendo
// import-historical-seasons.ts (per arricchire 2005-06→2010-11 con
// docs/classifiche.md) sono state ri-eseguite anche le sue voci per
// 2011-12/2012-13 — team_name+position soltanto, nessun punto/gol — che
// hanno sovrascritto (stesso conflict key competition_id+team_id) le righe
// standings REALI già importate da import-season-2011-12.ts/
// import-season-2012-13.ts, azzerando punti/gol/V-N-P/fantavoto per le
// posizioni 1-2 (2011-12) e 1-3 (2012-13) — le uniche squadre menzionate in
// quelle voci storiche.
//
// Fix: ricalcola punti/gol/V-N-P/fantavoto per TUTTE le squadre di entrambe
// le stagioni sommando le partite reali già in `matches` (190 = 38
// giornate × 5, nessuna anomalia) — stessa logica di aggregazione di
// getStandingsForRange (apps/web/lib/queries/classifica.ts). La posizione
// resta quella già presente in `standings` (mai stata corrotta, solo le
// statistiche lo erano) — non viene ricalcolata da un ordinamento nostro
// per non rischiare di divergere dai criteri di spareggio della fonte
// originale.
//
// La causa (import-historical-seasons.ts che rischiava di ripetere il
// danno a ogni rilancio) è stata rimossa in questo stesso commit: le voci
// 2011-12/2012-13 lì non toccano più `standings` di Campionato.
//
// Uso:
//   dotenv-cli -e .env.local -- tsx packages/ingestion/scripts/recompute-standings-2011-12-2012-13.ts
import { createIngestionClient } from '../lib/supabase-client.js';

type Acc = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  totalFantapoints: number;
};

function emptyAcc(): Acc {
  return { played: 0, won: 0, drawn: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, totalFantapoints: 0 };
}

async function recompute(client: ReturnType<typeof createIngestionClient>, slug: string): Promise<void> {
  const { data: season } = await client.from('seasons').select('id').eq('slug', slug).single();
  if (!season) throw new Error(`Stagione ${slug} non trovata`);
  const { data: competition } = await client
    .from('competitions')
    .select('id')
    .eq('season_id', season.id)
    .eq('slug', 'campionato')
    .single();
  if (!competition) throw new Error(`Competizione campionato non trovata per ${slug}`);

  const { data: matchdays } = await client.from('matchdays').select('id').eq('competition_id', competition.id);
  const { data: matches, error: matchesError } = await client
    .from('matches')
    .select('home_team_id, away_team_id, home_result_points, away_result_points, home_goals, away_goals, home_score, away_score')
    .in('matchday_id', (matchdays ?? []).map((m) => m.id));
  if (matchesError) throw matchesError;
  if ((matches ?? []).length !== 190) {
    throw new Error(`${slug}: attese 190 partite (38 giornate × 5), trovate ${matches?.length ?? 0}. Interrompo.`);
  }

  const acc = new Map<string, Acc>();
  function ensure(teamId: string): Acc {
    let a = acc.get(teamId);
    if (!a) {
      a = emptyAcc();
      acc.set(teamId, a);
    }
    return a;
  }
  for (const m of matches ?? []) {
    const home = ensure(m.home_team_id);
    home.played += 1;
    home.points += m.home_result_points ?? 0;
    home.goalsFor += m.home_goals ?? 0;
    home.goalsAgainst += m.away_goals ?? 0;
    home.totalFantapoints += Number(m.home_score ?? 0);
    if (m.home_result_points === 3) home.won += 1;
    else if (m.home_result_points === 1) home.drawn += 1;
    else if (m.home_result_points === 0) home.lost += 1;

    if (!m.away_team_id) continue;
    const away = ensure(m.away_team_id);
    away.played += 1;
    away.points += m.away_result_points ?? 0;
    away.goalsFor += m.away_goals ?? 0;
    away.goalsAgainst += m.home_goals ?? 0;
    away.totalFantapoints += Number(m.away_score ?? 0);
    if (m.away_result_points === 3) away.won += 1;
    else if (m.away_result_points === 1) away.drawn += 1;
    else if (m.away_result_points === 0) away.lost += 1;
  }

  const { data: existingStandings } = await client
    .from('standings')
    .select('team_id, position')
    .eq('competition_id', competition.id);
  const positionByTeam = new Map((existingStandings ?? []).map((r) => [r.team_id, r.position]));

  const { data: teams } = await client.from('teams').select('id, canonical_name').in('id', [...acc.keys()]);
  const nameById = new Map((teams ?? []).map((t) => [t.id, t.canonical_name]));

  const rows: { competition_id: string; team_id: string; position: number | null; played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; goal_diff: number; points: number; total_fantapoints: number }[] = [];
  for (const [teamId, a] of acc) {
    const position = positionByTeam.get(teamId) ?? null;
    rows.push({
      competition_id: competition.id,
      team_id: teamId,
      position,
      played: a.played,
      won: a.won,
      drawn: a.drawn,
      lost: a.lost,
      goals_for: a.goalsFor,
      goals_against: a.goalsAgainst,
      goal_diff: a.goalsFor - a.goalsAgainst,
      points: a.points,
      total_fantapoints: a.totalFantapoints,
    });
    console.log(
      `  ${slug} pos ${position ?? '?'} ${nameById.get(teamId)}: pt=${a.points} gf=${a.goalsFor} ga=${a.goalsAgainst} v=${a.won} n=${a.drawn} p=${a.lost} fp=${a.totalFantapoints.toFixed(2)}`,
    );
  }

  const { error: upsertError } = await client.from('standings').upsert(rows as never, { onConflict: 'competition_id, team_id' });
  if (upsertError) throw new Error(`Errore upsert standings ${slug}: ${upsertError.message}`);
  console.log(`${slug}: ${rows.length} righe standings ricalcolate e salvate.\n`);
}

async function main(): Promise<void> {
  const client = createIngestionClient();
  await recompute(client, '2011-12');
  await recompute(client, '2012-13');
}

main().catch((err: unknown) => {
  console.error('Ricalcolo standings 2011-12/2012-13 fallito:', err);
  process.exit(1);
});
