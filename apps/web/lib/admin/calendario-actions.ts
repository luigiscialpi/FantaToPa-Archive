// apps/web/lib/admin/calendario-actions.ts
//
// Editing Calendario: home/away score (fantavoto) e gol reali di
// `matches`. Nessuna funzione security definer: la RLS write-admin già
// esistente su `matches` è la sola autorità, stesso principio di
// updateStandingsRowAction/updateLineupPlayerAction.
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

// Stesso calcolo usato in import (resultPointsFromGoals in
// adapters/xlsx/calendar.ts): 3/1/0 dai gol reali, mai dal fantavoto.
function resultPoints(homeGoals: number, awayGoals: number): { home: number; away: number } {
  if (homeGoals > awayGoals) return { home: 3, away: 0 };
  if (homeGoals === awayGoals) return { home: 1, away: 1 };
  return { home: 0, away: 3 };
}

export async function updateMatchAction(matchId: string, formData: FormData): Promise<void> {
  const supabase = await createClient();
  const session = await getSessionState();
  const adminUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  const { data: before, error: beforeError } = await supabase
    .from('matches')
    .select('id, home_score, away_score, home_goals, away_goals, home_result_points, away_result_points')
    .eq('id', matchId)
    .single();

  if (beforeError) {
    throw new Error(`Partita non trovata: ${beforeError.message}`);
  }

  const homeScore = parseOptionalNumber(formData.get('homeScore'));
  const awayScore = parseOptionalNumber(formData.get('awayScore'));
  const homeGoals = parseOptionalInt(formData.get('homeGoals'));
  const awayGoals = parseOptionalInt(formData.get('awayGoals'));
  const points = homeGoals !== null && awayGoals !== null ? resultPoints(homeGoals, awayGoals) : null;

  const after = {
    home_score: homeScore,
    away_score: awayScore,
    home_goals: homeGoals,
    away_goals: awayGoals,
    home_result_points: points?.home ?? null,
    away_result_points: points?.away ?? null,
  };

  const { error } = await supabase.from('matches').update(after).eq('id', matchId);

  if (error) {
    throw new Error(`Impossibile salvare la partita: ${error.message}`);
  }

  if (adminUserId) {
    await logAdminEdit(supabase, {
      adminUserId,
      tableName: 'matches',
      rowId: matchId,
      action: 'update',
      before,
      after: { id: matchId, ...after },
    });
  }

  revalidatePath('/stagioni/[season]/calendario', 'page');
}
