// apps/web/lib/admin/formazioni-actions.ts
//
// Editing Formazioni: voto/fantavoto/conta-per-totale su lineup_players,
// aggiunta/rimozione bonus-malus su player_matchday_bonuses. Nessuna
// funzione security definer qui: la RLS write-admin già esistente su
// entrambe le tabelle (schema_iniziale.sql/player_matchday_bonuses.sql) è
// la sola autorità, stesso principio di approveRegistration/rejectRegistration.
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

export async function updateLineupPlayerAction(lineupPlayerId: string, formData: FormData): Promise<void> {
  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: before, error: beforeError } = await supabase
    .from('lineup_players')
    .select('id, voto, fantavoto, counts_for_total')
    .eq('id', lineupPlayerId)
    .single();

  if (beforeError) {
    throw new Error(`Giocatore in formazione non trovato: ${beforeError.message}`);
  }

  const voto = parseOptionalNumber(formData.get('voto'));
  const fantavoto = parseOptionalNumber(formData.get('fantavoto'));
  const countsForTotal = formData.get('countsForTotal') === 'on';

  const { error } = await supabase
    .from('lineup_players')
    .update({ voto, fantavoto, counts_for_total: countsForTotal })
    .eq('id', lineupPlayerId);

  if (error) {
    throw new Error(`Impossibile salvare voto/fantavoto: ${error.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'lineup_players',
      rowId: lineupPlayerId,
      action: 'update',
      before,
      after: { id: lineupPlayerId, voto, fantavoto, counts_for_total: countsForTotal },
    });
  }

  revalidatePath('/stagioni/[season]/formazioni', 'page');
}

export async function addPlayerBonusAction(
  matchdayId: string,
  playerId: string,
  formData: FormData,
): Promise<void> {
  const kindCode = formData.get('kindCode');
  if (typeof kindCode !== 'string' || !kindCode) {
    throw new Error('Seleziona un tipo di bonus/malus.');
  }

  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: existing, error: existingError } = await supabase
    .from('player_matchday_bonuses')
    .select('position_order')
    .eq('matchday_id', matchdayId)
    .eq('player_id', playerId)
    .order('position_order', { ascending: false })
    .limit(1);

  if (existingError) {
    throw new Error(`Impossibile leggere i bonus/malus esistenti: ${existingError.message}`);
  }

  const nextPositionOrder = (existing[0]?.position_order ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from('player_matchday_bonuses')
    .insert({ matchday_id: matchdayId, player_id: playerId, kind_code: kindCode, position_order: nextPositionOrder })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Impossibile aggiungere il bonus/malus: ${error.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'player_matchday_bonuses',
      rowId: inserted.id,
      action: 'insert',
      before: null,
      after: { matchday_id: matchdayId, player_id: playerId, kind_code: kindCode },
    });
  }

  revalidatePath('/stagioni/[season]/formazioni', 'page');
}

export async function removePlayerBonusAction(bonusId: string): Promise<void> {
  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: before, error: beforeError } = await supabase
    .from('player_matchday_bonuses')
    .select('id, matchday_id, player_id, kind_code')
    .eq('id', bonusId)
    .single();

  if (beforeError) {
    throw new Error(`Bonus/malus non trovato: ${beforeError.message}`);
  }

  const { error } = await supabase.from('player_matchday_bonuses').delete().eq('id', bonusId);

  if (error) {
    throw new Error(`Impossibile rimuovere il bonus/malus: ${error.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'player_matchday_bonuses',
      rowId: bonusId,
      action: 'delete',
      before,
      after: null,
    });
  }

  revalidatePath('/stagioni/[season]/formazioni', 'page');
}
