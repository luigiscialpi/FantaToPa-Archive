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

  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: season, error } = await supabase
    .from('seasons')
    .insert({
      slug: slug.trim(),
      label: label.trim(),
      starts_on: parseOptionalDate(formData.get('startsOn')),
      ends_on: parseOptionalDate(formData.get('endsOn')),
    })
    .select('id, slug')
    .single();

  if (error) {
    throw new Error(`Impossibile creare la stagione: ${error.message}`);
  }

  // Ogni stagione ha sempre almeno il Campionato (stesso default usato
  // dall'ingestion, ensureCompetitions in import-season.ts): senza questa
  // competizione non c'è nessuna classifica da completare.
  const { error: competitionError } = await supabase.from('competitions').insert({
    season_id: season.id,
    name: 'Campionato',
    kind_code: 'campionato',
    format_code: 'girone_unico',
    slug: 'campionato',
  });

  if (competitionError) {
    throw new Error(`Stagione creata ma impossibile creare il Campionato: ${competitionError.message}`);
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

export async function addStandingsRowAction(competitionId: string, formData: FormData): Promise<void> {
  const teamId = formData.get('teamId');
  const newTeamName = formData.get('newTeamName');
  const hasNewTeamName = typeof newTeamName === 'string' && newTeamName.trim() !== '';

  if ((typeof teamId !== 'string' || !teamId) && !hasNewTeamName) {
    throw new Error('Seleziona una squadra esistente o indicane una nuova.');
  }

  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  // Una nuova squadra (mai vista in nessuna stagione già importata, come
  // Igino/Naes/Pier 92 in import-historical-seasons.ts) ha la precedenza
  // sul teamId selezionato: la select è disabilitata lato UI quando si
  // compila questo campo, ma non fidarsi solo del client.
  let resolvedTeamId: string;
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

  revalidatePath('/admin/stagioni/[slug]', 'page');
  revalidatePath('/stagioni/[season]/classifica', 'page');
}
