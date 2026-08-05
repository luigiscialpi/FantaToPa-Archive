// apps/web/lib/admin/classifica-actions.ts
//
// Editing Classifica: righe di `standings` (posizione, G/V/N/P, Gf/Gs,
// punti, fantapunti totali). Nessuna funzione security definer qui: la RLS
// write-admin già esistente su `standings` (schema_iniziale.sql) è la sola
// autorità, stesso principio di updateLineupPlayerAction.
//
// Editabile SOLO lo snapshot reale (righe con un `id`, da getStandings):
// la vista filtrata per range di giornate (getStandingsForRange) è
// calcolata al volo dalle partite, non corrisponde a nessuna riga scrivibile.
'use server';

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

export async function updateStandingsRowAction(standingsId: string, formData: FormData): Promise<void> {
  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: before, error: beforeError } = await supabase
    .from('standings')
    .select('id, position, played, won, drawn, lost, goals_for, goals_against, goal_diff, points, total_fantapoints')
    .eq('id', standingsId)
    .single();

  if (beforeError) {
    throw new Error(`Riga di classifica non trovata: ${beforeError.message}`);
  }

  const position = parseOptionalInt(formData.get('position'));
  const played = parseOptionalInt(formData.get('played'));
  const won = parseOptionalInt(formData.get('won'));
  const drawn = parseOptionalInt(formData.get('drawn'));
  const lost = parseOptionalInt(formData.get('lost'));
  const goalsFor = parseOptionalInt(formData.get('goalsFor'));
  const goalsAgainst = parseOptionalInt(formData.get('goalsAgainst'));
  const points = parseOptionalInt(formData.get('points'));
  const totalFantapoints = parseOptionalNumber(formData.get('totalFantapoints'));
  // Stesso calcolo usato in import (upsertStandings): differenza reti solo
  // se entrambi i lati sono presenti, mai uno zero fabbricato.
  const goalDiff = goalsFor !== null && goalsAgainst !== null ? goalsFor - goalsAgainst : null;

  const after = {
    position,
    played,
    won,
    drawn,
    lost,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    goal_diff: goalDiff,
    points,
    total_fantapoints: totalFantapoints,
  };

  const { error } = await supabase.from('standings').update(after).eq('id', standingsId);

  if (error) {
    throw new Error(`Impossibile salvare la riga di classifica: ${error.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'standings',
      rowId: standingsId,
      action: 'update',
      before,
      after: { id: standingsId, ...after },
    });
  }

  revalidatePath('/stagioni/[season]/classifica', 'page');
}
