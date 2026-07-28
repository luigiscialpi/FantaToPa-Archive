// apps/web/lib/queries/rose.ts
//
// Layer di query per Rose: stesso pattern di classifica.ts/calendario.ts
// (AGENTS.md vieta query Supabase nei componenti React). Niente embed
// postgrest — query separate (rosters, players, player_roles, teams) +
// merge in memoria.
//
// A differenza di Classifica/Calendario, la rosa non ha una dimensione
// competizione: `rosters`/`player_roles` sono per (season_id, team_id), non
// per competition_id (vedi supabase/migrations) — qui la selezione è quindi
// per squadra, non per competizione.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';

type TypedSupabaseClient = SupabaseClient<Database>;

export type TeamOption = {
  id: string;
  slug: string;
  name: string;
};

export type RosterPlayerRow = {
  playerId: string;
  playerName: string;
  roleCodes: string[];
  realTeam: string | null;
  cost: number | null;
};

// Ordine "Mantra" standard (portiere → difensori → centrocampisti →
// attaccanti), lo stesso ordine con cui i ruoli sono caricati nella lookup
// table roles (vedi pilot-import-2025-26.ts). Serve solo a ordinare la rosa
// in modo leggibile, non a validare i codici — quello resta compito
// dell'import (Zod + FK su roles).
const ROLE_ORDER = ['Por', 'Dc', 'Ds', 'Dd', 'B', 'E', 'M', 'C', 'W', 'T', 'A', 'Pc'];

function roleRank(roleCodes: string[]): number {
  if (roleCodes.length === 0) return ROLE_ORDER.length;
  const ranks = roleCodes.map((code) => {
    const index = ROLE_ORDER.indexOf(code);
    return index === -1 ? ROLE_ORDER.length : index;
  });
  return Math.min(...ranks);
}

export async function getTeamsWithRoster(supabase: TypedSupabaseClient, seasonId: string): Promise<TeamOption[]> {
  const { data: rosterRows, error: rosterError } = await supabase
    .from('rosters')
    .select('team_id')
    .eq('season_id', seasonId);

  if (rosterError) {
    throw new Error(`Impossibile leggere le squadre della rosa: ${rosterError.message}`);
  }

  const teamIds = [...new Set(rosterRows.map((row) => row.team_id))];
  if (teamIds.length === 0) {
    return [];
  }

  const { data: teamsRows, error: teamsError } = await supabase
    .from('teams')
    .select('id, slug, canonical_name')
    .in('id', teamIds)
    .order('canonical_name', { ascending: true });

  if (teamsError) {
    throw new Error(`Impossibile leggere le squadre: ${teamsError.message}`);
  }

  return teamsRows.map((team) => ({ id: team.id, slug: team.slug, name: team.canonical_name }));
}

export async function getRoster(
  supabase: TypedSupabaseClient,
  seasonId: string,
  teamId: string,
): Promise<RosterPlayerRow[]> {
  const { data: rosterRows, error: rosterError } = await supabase
    .from('rosters')
    .select('player_id, real_team, cost')
    .eq('season_id', seasonId)
    .eq('team_id', teamId);

  if (rosterError) {
    throw new Error(`Impossibile leggere la rosa: ${rosterError.message}`);
  }

  if (rosterRows.length === 0) {
    return [];
  }

  const playerIds = rosterRows.map((row) => row.player_id);

  const [playersResult, rolesResult] = await Promise.all([
    supabase.from('players').select('id, canonical_name').in('id', playerIds),
    supabase.from('player_roles').select('player_id, role_code').eq('season_id', seasonId).in('player_id', playerIds),
  ]);

  if (playersResult.error) {
    throw new Error(`Impossibile leggere i giocatori: ${playersResult.error.message}`);
  }
  if (rolesResult.error) {
    throw new Error(`Impossibile leggere i ruoli: ${rolesResult.error.message}`);
  }

  const playerNameById = new Map<string, string>();
  for (const player of playersResult.data) {
    playerNameById.set(player.id, player.canonical_name);
  }

  const roleCodesByPlayer = new Map<string, string[]>();
  for (const role of rolesResult.data) {
    const bucket = roleCodesByPlayer.get(role.player_id);
    if (bucket) {
      bucket.push(role.role_code);
    } else {
      roleCodesByPlayer.set(role.player_id, [role.role_code]);
    }
  }

  const players: RosterPlayerRow[] = rosterRows.map((row) => ({
    playerId: row.player_id,
    playerName: playerNameById.get(row.player_id) ?? '—',
    roleCodes: roleCodesByPlayer.get(row.player_id) ?? [],
    realTeam: row.real_team,
    cost: row.cost,
  }));

  players.sort((a, b) => {
    const rankDiff = roleRank(a.roleCodes) - roleRank(b.roleCodes);
    if (rankDiff !== 0) return rankDiff;
    return a.playerName.localeCompare(b.playerName, 'it');
  });

  return players;
}
