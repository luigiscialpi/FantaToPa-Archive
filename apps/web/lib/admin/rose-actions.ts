// apps/web/lib/admin/rose-actions.ts
//
// Editing Rose: cost/real_team per giocatore in rosa (`rosters`) e crediti
// residui asta per squadra (`team_seasons.credits_remaining`). Nessuna
// funzione security definer: le RLS write-admin già esistenti (`rosters`,
// `team_seasons`) sono la sola autorità, stesso principio delle altre
// azioni di editing admin.
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../supabase/server';
import { getSessionState } from '../auth/session';
import { logAdminEdit } from './audit';

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value.trim();
}

export async function updateRosterPlayerAction(rosterId: string, formData: FormData): Promise<void> {
  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: before, error: beforeError } = await supabase
    .from('rosters')
    .select('id, real_team, cost')
    .eq('id', rosterId)
    .single();

  if (beforeError) {
    throw new Error(`Giocatore in rosa non trovato: ${beforeError.message}`);
  }

  const after = {
    real_team: parseOptionalText(formData.get('realTeam')),
    cost: parseOptionalNumber(formData.get('cost')),
  };

  const { error } = await supabase.from('rosters').update(after).eq('id', rosterId);

  if (error) {
    throw new Error(`Impossibile salvare il giocatore in rosa: ${error.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'rosters',
      rowId: rosterId,
      action: 'update',
      before,
      after: { id: rosterId, ...after },
    });
  }

  revalidatePath('/stagioni/[season]/rose', 'page');
}

export async function updateTeamCreditsAction(
  seasonId: string,
  teamId: string,
  formData: FormData,
): Promise<void> {
  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: before, error: beforeError } = await supabase
    .from('team_seasons')
    .select('team_id, season_id, credits_remaining')
    .eq('season_id', seasonId)
    .eq('team_id', teamId)
    .single();

  if (beforeError) {
    throw new Error(`Squadra/stagione non trovata: ${beforeError.message}`);
  }

  const creditsRemaining = parseOptionalNumber(formData.get('creditsRemaining'));

  const { error } = await supabase
    .from('team_seasons')
    .update({ credits_remaining: creditsRemaining })
    .eq('season_id', seasonId)
    .eq('team_id', teamId);

  if (error) {
    throw new Error(`Impossibile salvare i crediti residui: ${error.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'team_seasons',
      rowId: null,
      action: 'update',
      before,
      after: { team_id: teamId, season_id: seasonId, credits_remaining: creditsRemaining },
    });
  }

  revalidatePath('/stagioni/[season]/rose', 'page');
}
