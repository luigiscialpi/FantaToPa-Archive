// apps/web/lib/admin/season-actions.ts
//
// Creazione di una nuova stagione da pannello admin (sezione "Stagioni") e
// completamento della sua classifica Campionato aggiungendo squadre non
// ancora presenti — stesso principio delle altre azioni di editing admin:
// nessuna funzione security definer, la RLS write-admin già esistente su
// seasons/competitions/standings è la sola autorità. L'editing delle righe
// già esistenti riusa updateStandingsRowAction (classifica-actions.ts),
// qui c'è solo la creazione (stagione, Campionato di default, nuova riga
// di classifica per una squadra che ancora non ce l'ha).
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../supabase/server';
import { getSessionState } from '../auth/session';
import { logAdminEdit } from './audit';

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDate(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function parseOptionalText(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const COPPA_FASE_FINALE = {
  name: 'Coppa Lelle - Fase Finale',
  slug: 'coppa-fase-finale',
  kind_code: 'coppa_fase_finale',
  format_code: 'eliminazione_diretta',
} as const;

// ponytail: stessa regola minimale già usata in ingestion
// (supabase-season-repository.ts) — duplicata qui invece di importata perché
// quel pacchetto gira solo da script (service role key, import con
// estensione .js), mai dal bundle web.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createSeasonAction(formData: FormData): Promise<void> {
  const slug = formData.get('slug');
  const label = formData.get('label');

  if (typeof slug !== 'string' || !slug.trim()) {
    throw new Error('Slug obbligatorio (es. "2008-09").');
  }
  if (typeof label !== 'string' || !label.trim()) {
    throw new Error('Etichetta obbligatoria (es. "Stagione 2008/2009").');
  }
  const startsOn = parseOptionalDate(formData.get('startsOn'));
  if (!startsOn) {
    // Obbligatoria: getSeasons ordina per starts_on desc, una stagione senza
    // questa data finirebbe fuori posto (Postgres mette i NULL per primi in
    // un ORDER BY DESC) invece che nella sua posizione cronologica reale.
    throw new Error('Data di inizio obbligatoria: serve per ordinare correttamente le stagioni.');
  }

  const isCompleted = formData.get('isCompleted') === 'on';
  const createCoppa = formData.get('createCoppa') === 'on';
  const explicitEndsOn = parseOptionalDate(formData.get('endsOn'));
  // Una stagione marcata "conclusa" senza una data di fine nota (dati
  // storici incompleti) deve comunque smettere di apparire "in corso" in
  // Home/Albo d'Oro (getSeasonGallery: inProgress = ends_on === null ||
  // ends_on > oggi) — la data odierna basta come sentinella, `ends_on` non
  // è mostrato altrove in UI.
  const endsOn = explicitEndsOn ?? (isCompleted ? new Date().toISOString().slice(0, 10) : null);

  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: season, error } = await supabase
    .from('seasons')
    .insert({
      slug: slug.trim(),
      label: label.trim(),
      starts_on: startsOn,
      ends_on: endsOn,
    })
    .select('id, slug')
    .single();

  if (error) {
    throw new Error(`Impossibile creare la stagione: ${error.message}`);
  }

  // Ogni stagione ha sempre almeno il Campionato (stesso default usato
  // dall'ingestion, ensureCompetitions in import-season.ts): senza questa
  // competizione non c'è nessuna classifica da completare. La Coppa fase
  // finale è opzionale, solo su richiesta esplicita dell'admin.
  const competitionsToCreate: { season_id: string; name: string; kind_code: string; format_code: string; slug: string }[] = [
    { season_id: season.id, name: 'Campionato', kind_code: 'campionato', format_code: 'girone_unico', slug: 'campionato' },
  ];
  if (createCoppa) {
    competitionsToCreate.push({ season_id: season.id, ...COPPA_FASE_FINALE });
  }

  const { error: competitionError } = await supabase.from('competitions').insert(competitionsToCreate);

  if (competitionError) {
    throw new Error(`Stagione creata ma impossibile creare le competizioni: ${competitionError.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'seasons',
      rowId: season.id,
      action: 'insert',
      before: null,
      after: { slug: season.slug },
    });
  }

  revalidatePath('/admin/stagioni', 'page');
  redirect(`/admin/stagioni/${season.slug}`);
}

// Aggiunge la Coppa fase finale a una stagione già esistente che non l'ha
// creata al momento della creazione (checkbox facoltativa in
// createSeasonAction) — stessa competizione, stesso slug/kind/format, per
// non frammentare la convenzione già usata dall'ingestion/import storico.
export async function addCoppaCompetitionAction(seasonId: string): Promise<void> {
  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: inserted, error } = await supabase
    .from('competitions')
    .insert({ season_id: seasonId, ...COPPA_FASE_FINALE })
    .select('id')
    .single();

  if (error) {
    // Vincolo unique (season_id, slug): la Coppa esiste già per questa stagione.
    throw new Error(`Impossibile creare la Coppa: ${error.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'competitions',
      rowId: inserted.id,
      action: 'insert',
      before: null,
      after: { season_id: seasonId, slug: COPPA_FASE_FINALE.slug },
    });
  }

  revalidatePath('/admin/stagioni/[slug]', 'page');
}

// Aggiunge una giornata (matchday) a un torneo/competizione esistente —
// solo la riga in `matchdays`, nessuna partita: le partite/formazioni si
// aggiungono separatamente (Calendario/Formazioni in modalità modifica),
// questa azione serve solo a "sbloccare" quella giornata perché esista da
// collegare.
export async function addMatchdayAction(competitionId: string, formData: FormData): Promise<void> {
  const numberRaw = formData.get('number');
  const number = typeof numberRaw === 'string' ? Number.parseInt(numberRaw, 10) : NaN;
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error('Numero giornata non valido.');
  }

  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: inserted, error } = await supabase
    .from('matchdays')
    .insert({ competition_id: competitionId, number, label: parseOptionalText(formData.get('label')) })
    .select('id')
    .single();

  if (error) {
    // Vincolo unique (competition_id, number): la giornata esiste già.
    throw new Error(`Impossibile aggiungere la giornata: ${error.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'matchdays',
      rowId: inserted.id,
      action: 'insert',
      before: null,
      after: { competition_id: competitionId, number },
    });
  }

  revalidatePath('/admin/stagioni/[slug]', 'page');
  revalidatePath('/stagioni/[season]/calendario', 'page');
  revalidatePath('/stagioni/[season]/formazioni', 'page');
}

const DELETE_CHUNK_SIZE = 100;

// Cancellazioni con .in() su decine/centinaia di id: stessa cautela già
// nota per le letture (AGENTS.md, troncamento/URL troppo lunga oltre ~1000
// id) — a scaglioni piccoli invece di un unico .in() con tutti gli id.
async function deleteInChunks(
  ids: string[],
  run: (chunk: string[]) => PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  for (let i = 0; i < ids.length; i += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + DELETE_CHUNK_SIZE);
    const { error } = await run(chunk);
    if (error) {
      throw new Error(error.message);
    }
  }
}

// Eliminazione completa di una stagione e di tutto ciò che dipende da lei.
// Solo lineup_players (via lineups) e player_matchday_bonuses/
// matchday_bonus_sources (via matchdays) hanno `on delete cascade` nello
// schema (20260726000000_schema_iniziale.sql/20260731090000_...): ogni
// altra tabella che referenzia season_id/competition_id/matchday_id/
// match_id va svuotata esplicitamente, in ordine figlio → genitore,
// altrimenti la FK blocca il delete.
export async function deleteSeasonAction(seasonId: string): Promise<void> {
  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('id, slug, label')
    .eq('id', seasonId)
    .single();

  if (seasonError) {
    throw new Error(`Stagione non trovata: ${seasonError.message}`);
  }

  const { data: competitions, error: competitionsError } = await supabase
    .from('competitions')
    .select('id')
    .eq('season_id', seasonId);
  if (competitionsError) {
    throw new Error(`Impossibile leggere le competizioni: ${competitionsError.message}`);
  }
  const competitionIds = competitions.map((competition) => competition.id);

  let matchdayIds: string[] = [];
  if (competitionIds.length > 0) {
    const { data: matchdays, error: matchdaysError } = await supabase
      .from('matchdays')
      .select('id')
      .in('competition_id', competitionIds);
    if (matchdaysError) {
      throw new Error(`Impossibile leggere le giornate: ${matchdaysError.message}`);
    }
    matchdayIds = matchdays.map((matchday) => matchday.id);
  }

  let matchIds: string[] = [];
  if (matchdayIds.length > 0) {
    const { data: matches, error: matchesError } = await supabase.from('matches').select('id').in('matchday_id', matchdayIds);
    if (matchesError) {
      throw new Error(`Impossibile leggere le partite: ${matchesError.message}`);
    }
    matchIds = matches.map((match) => match.id);
  }

  // lineup_players si elimina automaticamente a cascata insieme a lineups.
  if (matchIds.length > 0) {
    await deleteInChunks(matchIds, (chunk) => supabase.from('lineups').delete().in('match_id', chunk));
  }
  if (matchdayIds.length > 0) {
    await deleteInChunks(matchdayIds, (chunk) => supabase.from('matches').delete().in('matchday_id', chunk));
    // player_matchday_bonuses/matchday_bonus_sources si eliminano a cascata insieme a matchdays.
    await deleteInChunks(matchdayIds, (chunk) => supabase.from('matchdays').delete().in('id', chunk));
  }
  if (competitionIds.length > 0) {
    await deleteInChunks(competitionIds, (chunk) => supabase.from('standings').delete().in('competition_id', chunk));
  }

  const { error: rostersError } = await supabase.from('rosters').delete().eq('season_id', seasonId);
  if (rostersError) {
    throw new Error(`Impossibile eliminare le rose: ${rostersError.message}`);
  }

  const { error: playerRolesError } = await supabase.from('player_roles').delete().eq('season_id', seasonId);
  if (playerRolesError) {
    throw new Error(`Impossibile eliminare i ruoli giocatore: ${playerRolesError.message}`);
  }

  const { error: teamSeasonsError } = await supabase.from('team_seasons').delete().eq('season_id', seasonId);
  if (teamSeasonsError) {
    throw new Error(`Impossibile eliminare i dati squadra/stagione: ${teamSeasonsError.message}`);
  }

  const { error: marketValuesError } = await supabase.from('market_values').delete().eq('season_id', seasonId);
  if (marketValuesError) {
    throw new Error(`Impossibile eliminare le quotazioni: ${marketValuesError.message}`);
  }

  const { error: importBatchesError } = await supabase.from('import_batches').delete().eq('season_id', seasonId);
  if (importBatchesError) {
    throw new Error(`Impossibile eliminare gli import batch: ${importBatchesError.message}`);
  }

  if (competitionIds.length > 0) {
    const { error: competitionsDeleteError } = await supabase.from('competitions').delete().eq('season_id', seasonId);
    if (competitionsDeleteError) {
      throw new Error(`Impossibile eliminare le competizioni: ${competitionsDeleteError.message}`);
    }
  }

  const { error: seasonDeleteError } = await supabase.from('seasons').delete().eq('id', seasonId);
  if (seasonDeleteError) {
    throw new Error(`Impossibile eliminare la stagione: ${seasonDeleteError.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'seasons',
      rowId: seasonId,
      action: 'delete',
      before: { slug: season.slug, label: season.label },
      after: null,
    });
  }

  revalidatePath('/admin/stagioni', 'page');
  redirect('/admin/stagioni');
}

export async function addStandingsRowAction(seasonId: string, competitionId: string, formData: FormData): Promise<void> {
  // "owner" codifica un proprietario già noto come "<teamId>::<nomeProprietario>"
  // (vedi getKnownTeamOwners): selezionarlo risolve l'identità squadra
  // DIRETTAMENTE dalla persona, non dal nome — un proprietario che rinomina
  // la squadra da una stagione all'altra non ha più un nome combaciante fra
  // le opzioni "squadra esistente", che porterebbe a crearne per errore una
  // seconda invece di riusare la stessa identità. Stringa vuota = nuovo
  // proprietario, mai visto: si passa al flusso classico squadra esistente/
  // nuova, chiedendo anche il nome del proprietario stesso.
  const ownerRaw = formData.get('owner');
  const existingOwner = typeof ownerRaw === 'string' && ownerRaw.includes('::') ? ownerRaw.split('::') : null;
  const seasonDisplayName = parseOptionalText(formData.get('seasonDisplayName'));

  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  let resolvedTeamId: string;
  // Nome da riportare in team_seasons.manager_name per QUESTA stagione: per
  // un proprietario già noto è lo stesso nome (l'identità non cambia, solo
  // eventualmente il nome squadra); per uno nuovo è quello appena indicato.
  let managerName: string | null;

  if (existingOwner) {
    const [existingTeamId, existingOwnerName] = existingOwner;
    if (!existingTeamId) {
      throw new Error('Proprietario non valido.');
    }
    resolvedTeamId = existingTeamId;
    managerName = existingOwnerName || null;
  } else {
    const newOwnerName = parseOptionalText(formData.get('newOwnerName'));
    if (!newOwnerName) {
      throw new Error('Indica il nome del nuovo proprietario, oppure seleziona un proprietario già esistente.');
    }

    const teamId = formData.get('teamId');
    const newTeamName = formData.get('newTeamName');
    const hasNewTeamName = typeof newTeamName === 'string' && newTeamName.trim() !== '';

    if ((typeof teamId !== 'string' || !teamId) && !hasNewTeamName) {
      throw new Error('Seleziona una squadra esistente o indicane una nuova.');
    }

    // Una nuova squadra (mai vista in nessuna stagione già importata, come
    // Igino/Naes/Pier 92 in import-historical-seasons.ts) ha la precedenza
    // sul teamId selezionato: la select è disabilitata lato UI quando si
    // compila questo campo, ma non fidarsi solo del client.
    if (hasNewTeamName) {
      const name = (newTeamName as string).trim();
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({ canonical_name: name, slug: slugify(name) })
        .select('id')
        .single();

      if (teamError) {
        throw new Error(`Impossibile creare la squadra "${name}": ${teamError.message}`);
      }

      resolvedTeamId = team.id;

      if (adminUserId) {
        await logAdminEdit(supabase, {
          adminUserId,
          tableName: 'teams',
          rowId: team.id,
          action: 'insert',
          before: null,
          after: { canonical_name: name },
        });
      }
    } else {
      resolvedTeamId = teamId as string;
    }

    managerName = newOwnerName;
  }

  const goalsFor = parseOptionalInt(formData.get('goalsFor'));
  const goalsAgainst = parseOptionalInt(formData.get('goalsAgainst'));
  // Stesso calcolo usato in updateStandingsRowAction/import: differenza
  // reti solo se entrambi i lati sono presenti, mai uno zero fabbricato.
  const goalDiff = goalsFor !== null && goalsAgainst !== null ? goalsFor - goalsAgainst : null;

  const after = {
    competition_id: competitionId,
    team_id: resolvedTeamId,
    position: parseOptionalInt(formData.get('position')),
    played: parseOptionalInt(formData.get('played')),
    won: parseOptionalInt(formData.get('won')),
    drawn: parseOptionalInt(formData.get('drawn')),
    lost: parseOptionalInt(formData.get('lost')),
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    goal_diff: goalDiff,
    points: parseOptionalInt(formData.get('points')),
    total_fantapoints: parseOptionalNumber(formData.get('totalFantapoints')),
  };

  const { data: inserted, error } = await supabase.from('standings').insert(after).select('id').single();

  if (error) {
    // Vincolo unique (competition_id, team_id): la squadra ha già una riga
    // in questa classifica, va modificata da lì invece che ri-aggiunta.
    throw new Error(`Impossibile aggiungere la squadra alla classifica: ${error.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'standings',
      rowId: inserted.id,
      action: 'insert',
      before: null,
      after,
    });
  }

  // manager_name va riportato SEMPRE su questa stagione (anche per un
  // proprietario già noto, la cui ultima riga team_seasons nota potrebbe
  // essere di una stagione precedente) — display_name solo se l'admin ha
  // indicato esplicitamente un nome diverso per questa stagione (rinomina).
  const teamSeasonPatch: { team_id: string; season_id: string; manager_name?: string; display_name?: string } = {
    team_id: resolvedTeamId,
    season_id: seasonId,
  };
  if (managerName) teamSeasonPatch.manager_name = managerName;
  if (seasonDisplayName) teamSeasonPatch.display_name = seasonDisplayName;

  if (teamSeasonPatch.manager_name || teamSeasonPatch.display_name) {
    const { error: teamSeasonError } = await supabase
      .from('team_seasons')
      .upsert(teamSeasonPatch, { onConflict: 'team_id, season_id' });

    if (teamSeasonError) {
      throw new Error(`Squadra aggiunta alla classifica ma impossibile salvare proprietario/nome: ${teamSeasonError.message}`);
    }
  }

  revalidatePath('/admin/stagioni/[slug]', 'page');
  revalidatePath('/stagioni/[season]/classifica', 'page');
}

// Modifica etichetta/date di una stagione già esistente — serve soprattutto
// a correggere una stagione creata senza data di inizio PRIMA che diventasse
// obbligatoria (createSeasonAction): senza starts_on, getSeasons la ordina
// in cima a tutte le altre invece che nella sua posizione cronologica reale
// (Postgres mette i NULL per primi in un ORDER BY DESC).
export async function updateSeasonAction(seasonId: string, formData: FormData): Promise<void> {
  const label = formData.get('label');
  if (typeof label !== 'string' || !label.trim()) {
    throw new Error('Etichetta obbligatoria.');
  }
  const startsOn = parseOptionalDate(formData.get('startsOn'));
  if (!startsOn) {
    throw new Error('Data di inizio obbligatoria: serve per ordinare correttamente le stagioni.');
  }

  const isCompleted = formData.get('isCompleted') === 'on';
  const explicitEndsOn = parseOptionalDate(formData.get('endsOn'));
  const endsOn = explicitEndsOn ?? (isCompleted ? new Date().toISOString().slice(0, 10) : null);

  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: before, error: beforeError } = await supabase
    .from('seasons')
    .select('id, label, starts_on, ends_on')
    .eq('id', seasonId)
    .single();

  if (beforeError) {
    throw new Error(`Stagione non trovata: ${beforeError.message}`);
  }

  const after = { label: label.trim(), starts_on: startsOn, ends_on: endsOn };
  const { error } = await supabase.from('seasons').update(after).eq('id', seasonId);

  if (error) {
    throw new Error(`Impossibile salvare la stagione: ${error.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'seasons',
      rowId: seasonId,
      action: 'update',
      before,
      after: { id: seasonId, ...after },
    });
  }

  revalidatePath('/admin/stagioni', 'page');
  revalidatePath('/admin/stagioni/[slug]', 'page');
  revalidatePath('/albo-doro', 'page');
  revalidatePath('/', 'page');
}
