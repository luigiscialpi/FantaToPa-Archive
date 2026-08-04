// packages/ingestion/loader/supabase-season-repository.ts
//
// Implementazione reale di SeasonRepository su Supabase. Usa service role key,
// quindi va eseguita solo server-side (script di ingestion).
import { createIngestionClient } from '../lib/supabase-client.js';
import { normalizeName } from '../lib/normalize-name.js';
import type { Database } from '@fantatopa/shared-types/database.js';
import type {
  SeasonRepository,
  TeamSeed,
  PlayerSeed,
} from './season-repository.js';
import type {
  BonusImport,
  CalendarImport,
  LineupImport,
  RosterImport,
  StandingsImport,
} from '../schema/imports.js';

// ponytail: lo slug è solo per comodità interna; non serve una libreria
// esterna per una regola così semplice.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type SupabaseClient = ReturnType<typeof createIngestionClient>;

export class SupabaseSeasonRepository implements SeasonRepository {
  private readonly client: SupabaseClient;
  private readonly teamIdCache = new Map<string, string | undefined>();
  private readonly playerIdCache = new Map<string, string | undefined>();

  constructor(client?: SupabaseClient) {
    this.client = client ?? createIngestionClient();
  }

  private async upsertBatch(
    table: keyof Database['public']['Tables'],
    rows: Record<string, unknown>[],
    onConflict: string,
    batchSize = 200,
  ): Promise<void> {
    if (rows.length === 0) return;
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const { error } = await this.client.from(table).upsert(chunk as never, { onConflict });
      if (error) throw new Error(`Errore upsert batch su ${String(table)}: ${error.message}`);
    }
  }

  // ============================================================
  // Lookup base
  // ============================================================

  private async getSeasonId(slug: string): Promise<string> {
    const { data, error } = await this.client
      .from('seasons')
      .select('id')
      .eq('slug', slug)
      .single();
    if (error || !data) throw new Error(`Stagione "${slug}" non trovata: ${error?.message ?? 'riga assente'}`);
    return data.id;
  }

  private async getCompetitionId(seasonId: string, slug: string): Promise<string> {
    const { data, error } = await this.client
      .from('competitions')
      .select('id')
      .eq('season_id', seasonId)
      .eq('slug', slug)
      .single();
    if (error || !data) throw new Error(`Competizione "${slug}" non trovata per la stagione: ${error?.message ?? 'riga assente'}`);
    return data.id;
  }

  // ============================================================
  // Risoluzione alias
  // ============================================================

  async resolveTeamId(name: string): Promise<string | undefined> {
    const key = normalizeName(name);
    if (this.teamIdCache.has(key)) return this.teamIdCache.get(key);

    const { data: direct } = await this.client
      .from('teams')
      .select('id')
      .ilike('canonical_name', name.trim())
      .maybeSingle();
    if (direct) {
      this.teamIdCache.set(key, direct.id);
      return direct.id;
    }

    const { data: alias } = await this.client
      .from('team_aliases')
      .select('team_id')
      .eq('alias_normalized', key)
      .maybeSingle();
    const resolved = alias?.team_id ?? undefined;
    this.teamIdCache.set(key, resolved);
    return resolved;
  }

  async resolvePlayerId(name: string): Promise<string | undefined> {
    const key = normalizeName(name);
    if (this.playerIdCache.has(key)) return this.playerIdCache.get(key);

    const { data: direct } = await this.client
      .from('players')
      .select('id')
      .ilike('canonical_name', name.trim())
      .maybeSingle();
    if (direct) {
      this.playerIdCache.set(key, direct.id);
      return direct.id;
    }

    const { data: alias } = await this.client
      .from('player_aliases')
      .select('player_id')
      .eq('alias_normalized', key)
      .maybeSingle();
    const resolved = alias?.player_id ?? undefined;
    this.playerIdCache.set(key, resolved);
    return resolved;
  }

  // ============================================================
  // Seed squadre/giocatori
  // ============================================================

  async upsertTeams(teams: TeamSeed[]): Promise<void> {
    for (const team of teams) {
      const canonicalName = team.name.trim();
      const slug = slugify(canonicalName);
      const canonicalKey = normalizeName(canonicalName);

      const existing = await this.resolveTeamId(canonicalName);
      if (existing) {
        // ponytail: se la squadra esiste già, aggiorniamo solo gli alias mancanti.
        await this.ensureTeamAliases(existing, team.aliases ?? []);
        continue;
      }

      const { data, error } = await this.client
        .from('teams')
        .insert({ canonical_name: canonicalName, slug })
        .select('id')
        .single();
      if (error || !data) throw new Error(`Errore creazione squadra "${canonicalName}": ${error?.message ?? 'riga assente'}`);

      this.teamIdCache.set(canonicalKey, data.id);
      await this.ensureTeamAliases(data.id, [canonicalName, ...(team.aliases ?? [])]);
    }
  }

  private async ensureTeamAliases(teamId: string, aliases: string[]): Promise<void> {
    const rows = aliases
      .map((a) => normalizeName(a))
      .filter(Boolean)
      .map((alias_normalized) => ({ team_id: teamId, alias_normalized }));
    if (rows.length === 0) return;

    for (const row of rows) {
      this.teamIdCache.set(row.alias_normalized, teamId);
    }

    const { error } = await this.client.from('team_aliases').upsert(rows, { onConflict: 'alias_normalized' });
    if (error) throw new Error(`Errore alias squadra: ${error.message}`);
  }

  async upsertTeamSeasonDisplayName(teamId: string, seasonId: string, displayName: string): Promise<void> {
    const { error } = await this.client
      .from('team_seasons')
      .upsert({ team_id: teamId, season_id: seasonId, display_name: displayName }, { onConflict: 'team_id, season_id' });
    if (error) throw new Error(`Errore salvataggio nome stagione squadra: ${error.message}`);
  }

  async getTeamSeasonDisplayName(teamId: string, seasonId: string): Promise<string | undefined> {
    const { data, error } = await this.client
      .from('team_seasons')
      .select('display_name')
      .eq('team_id', teamId)
      .eq('season_id', seasonId)
      .maybeSingle();
    if (error) throw new Error(`Errore lettura nome stagione squadra: ${error.message}`);
    return data?.display_name ?? undefined;
  }

  async upsertPlayers(players: PlayerSeed[]): Promise<void> {
    for (const player of players) {
      const canonicalName = player.name.trim();
      const slug = slugify(canonicalName);
      const canonicalKey = normalizeName(canonicalName);

      const existing = await this.resolvePlayerId(canonicalName);
      if (existing) {
        await this.ensurePlayerAliases(existing, player.aliases ?? []);
        continue;
      }

      const { data, error } = await this.client
        .from('players')
        .insert({ canonical_name: canonicalName, slug })
        .select('id')
        .single();
      if (error || !data) throw new Error(`Errore creazione giocatore "${canonicalName}": ${error?.message ?? 'riga assente'}`);

      this.playerIdCache.set(canonicalKey, data.id);
      await this.ensurePlayerAliases(data.id, [canonicalName, ...(player.aliases ?? [])]);
    }
  }

  async ensurePlayerAliases(playerId: string, aliases: string[]): Promise<void> {
    const rows = aliases
      .map((a) => normalizeName(a))
      .filter(Boolean)
      .map((alias_normalized) => ({ player_id: playerId, alias_normalized }));
    if (rows.length === 0) return;

    for (const row of rows) {
      this.playerIdCache.set(row.alias_normalized, playerId);
    }

    const { error } = await this.client.from('player_aliases').upsert(rows, { onConflict: 'alias_normalized' });
    if (error) throw new Error(`Errore alias giocatore: ${error.message}`);
  }

  // ============================================================
  // Roster
  // ============================================================

  async upsertRoster(input: RosterImport): Promise<void> {
    const seasonId = await this.getSeasonId(input.seasonSlug);

    const rosterRows: Record<string, unknown>[] = [];
    const roleRows: Record<string, unknown>[] = [];
    for (const entry of input.entries) {
      const teamId = await this.resolveTeamId(entry.teamName);
      if (!teamId) throw new Error(`Squadra non trovata per la rosa: "${entry.teamName}"`);

      const playerId = await this.resolvePlayerId(entry.playerName);
      if (!playerId) throw new Error(`Giocatore non trovato per la rosa: "${entry.playerName}"`);

      rosterRows.push({
        season_id: seasonId,
        team_id: teamId,
        player_id: playerId,
        real_team: entry.realTeam ?? null,
        cost: entry.cost ?? null,
      });

      for (const roleCode of entry.roles) {
        roleRows.push({ player_id: playerId, season_id: seasonId, role_code: roleCode });
      }
    }
    await this.upsertBatch('rosters', rosterRows, 'season_id, team_id, player_id');
    await this.upsertBatch('player_roles', roleRows, 'player_id, season_id, role_code');

    const creditRows: Record<string, unknown>[] = [];
    for (const credit of input.teamCredits) {
      const teamId = await this.resolveTeamId(credit.teamName);
      if (!teamId) throw new Error(`Squadra non trovata per i crediti residui: "${credit.teamName}"`);

      creditRows.push({ team_id: teamId, season_id: seasonId, credits_remaining: credit.creditsRemaining });
    }
    await this.upsertBatch('team_seasons', creditRows, 'team_id, season_id');
  }

  // ============================================================
  // Standings
  // ============================================================

  async upsertStandings(input: StandingsImport): Promise<void> {
    const seasonId = await this.getSeasonId(input.seasonSlug);
    const competitionId = await this.getCompetitionId(seasonId, input.competitionSlug);

    const rows: Record<string, unknown>[] = [];
    for (const row of input.rows) {
      const teamId = await this.resolveTeamId(row.teamName);
      if (!teamId) throw new Error(`Squadra non trovata in classifica: "${row.teamName}"`);

      rows.push({
        competition_id: competitionId,
        team_id: teamId,
        position: row.position,
        played: row.played ?? null,
        won: row.won ?? null,
        drawn: row.drawn ?? null,
        lost: row.lost ?? null,
        goals_for: row.goalsFor ?? null,
        goals_against: row.goalsAgainst ?? null,
        goal_diff:
          row.goalsFor !== undefined && row.goalsAgainst !== undefined
            ? row.goalsFor - row.goalsAgainst
            : null,
        points: row.points ?? null,
        total_fantapoints: row.totalFantapoints ?? null,
      });
    }
    await this.upsertBatch('standings', rows, 'competition_id, team_id');
  }

  // ============================================================
  // Calendar
  // ============================================================

  async upsertCalendar(input: CalendarImport): Promise<void> {
    const seasonId = await this.getSeasonId(input.seasonSlug);
    const competitionId = await this.getCompetitionId(seasonId, input.competitionSlug);

    const matchdayRows = input.matchdays.map((matchday) => ({
      competition_id: competitionId,
      number: matchday.number,
      label: matchday.label ?? null,
    }));
    const { data: matchdayRowsDb, error: matchdayError } = await this.client
      .from('matchdays')
      .upsert(matchdayRows, { onConflict: 'competition_id, number' })
      .select('id, number');
    if (matchdayError || !matchdayRowsDb) throw new Error(`Errore upsert giornate: ${matchdayError?.message ?? 'riga assente'}`);

    const matchdayIdByNumber = new Map(matchdayRowsDb.map((row) => [row.number, row.id]));

    const matchRows: Record<string, unknown>[] = [];
    for (const matchday of input.matchdays) {
      const matchdayId = matchdayIdByNumber.get(matchday.number);
      if (!matchdayId) throw new Error(`Giornata ${matchday.number} non trovata dopo upsert`);

      for (const match of matchday.matches) {
        const homeTeamId = await this.resolveTeamId(match.homeTeamName);
        const awayTeamId = await this.resolveTeamId(match.awayTeamName);
        if (!homeTeamId) throw new Error(`Squadra home non trovata: "${match.homeTeamName}"`);
        if (!awayTeamId) throw new Error(`Squadra away non trovata: "${match.awayTeamName}"`);

        matchRows.push({
          matchday_id: matchdayId,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_score: match.homeScore,
          away_score: match.awayScore,
          home_goals: match.homeGoals,
          away_goals: match.awayGoals,
          home_result_points: match.homeResultPoints,
          away_result_points: match.awayResultPoints,
        });
      }
    }
    await this.upsertBatch('matches', matchRows, 'matchday_id, home_team_id, away_team_id');
  }

  // ============================================================
  // Lineup
  // ============================================================

  async upsertLineup(input: LineupImport): Promise<void> {
    const seasonId = await this.getSeasonId(input.seasonSlug);
    const competitionId = await this.getCompetitionId(seasonId, input.competitionSlug);

    const { data: matchdayRow, error: matchdayError } = await this.client
      .from('matchdays')
      .upsert(
        { competition_id: competitionId, number: input.matchdayNumber, label: input.matchdayLabel ?? null },
        { onConflict: 'competition_id, number' },
      )
      .select('id')
      .single();
    if (matchdayError || !matchdayRow) throw new Error(`Errore upsert giornata formazioni: ${matchdayError?.message ?? 'riga assente'}`);

    const matchdayId = matchdayRow.id;
    const matchesWithAway = input.matches.filter((match) => match.away != null);
    const matchesWithoutAway = input.matches.filter((match) => match.away == null);

    // Upsert in batch delle partite con avversario.
    const awayMatchRows: Record<string, unknown>[] = [];
    for (const match of matchesWithAway) {
      const homeTeamId = await this.resolveTeamId(match.home.teamName);
      const awayTeamId = await this.resolveTeamId(match.away!.teamName);
      if (!homeTeamId) throw new Error(`Squadra home non trovata: "${match.home.teamName}"`);
      if (!awayTeamId) throw new Error(`Squadra away non trovata: "${match.away!.teamName}"`);

      awayMatchRows.push({
        matchday_id: matchdayId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_score: match.home.total,
        away_score: match.away!.total,
      });
    }

    const { data: awayMatchRowsDb, error: awayMatchError } = await this.client
      .from('matches')
      .upsert(awayMatchRows as never, { onConflict: 'matchday_id, home_team_id, away_team_id' })
      .select('id, home_team_id, away_team_id');
    if (awayMatchError || !awayMatchRowsDb) throw new Error(`Errore upsert partite formazioni: ${awayMatchError?.message ?? 'riga assente'}`);

    const matchIdByTeams = new Map<string, string>();
    for (const row of awayMatchRowsDb) {
      matchIdByTeams.set(`${row.home_team_id}:${row.away_team_id}`, row.id);
    }

    // Partite senza avversario (girone dispari): find-or-create manuale.
    for (const match of matchesWithoutAway) {
      const homeTeamId = await this.resolveTeamId(match.home.teamName);
      if (!homeTeamId) throw new Error(`Squadra home non trovata: "${match.home.teamName}"`);

      const { data: existing, error: existingError } = await this.client
        .from('matches')
        .select('id')
        .eq('matchday_id', matchdayId)
        .eq('home_team_id', homeTeamId)
        .is('away_team_id', null)
        .maybeSingle();
      if (existingError) throw new Error(`Errore lettura partita solo formazioni: ${existingError.message}`);

      let matchId: string;
      if (existing) {
        const { error: updateError } = await this.client
          .from('matches')
          .update({ home_score: match.home.total })
          .eq('id', existing.id);
        if (updateError) throw new Error(`Errore aggiornamento partita solo formazioni: ${updateError.message}`);
        matchId = existing.id;
      } else {
        const { data: inserted, error: insertError } = await this.client
          .from('matches')
          .insert({ matchday_id: matchdayId, home_team_id: homeTeamId, away_team_id: null, home_score: match.home.total })
          .select('id')
          .single();
        if (insertError || !inserted) throw new Error(`Errore inserimento partita solo formazioni: ${insertError?.message ?? 'riga assente'}`);
        matchId = inserted.id;
      }
      matchIdByTeams.set(`${homeTeamId}:null`, matchId);
    }

    // Costruisce le righe di lineup in batch.
    const lineupRows: Record<string, unknown>[] = [];
    for (const match of matchesWithAway) {
      const homeTeamId = await this.resolveTeamId(match.home.teamName);
      const awayTeamId = await this.resolveTeamId(match.away!.teamName);
      if (!homeTeamId || !awayTeamId) throw new Error(`Squadra non risolta per lineup`);
      const matchId = matchIdByTeams.get(`${homeTeamId}:${awayTeamId}`);
      if (!matchId) throw new Error(`Partita non trovata per lineup: ${homeTeamId} vs ${awayTeamId}`);

      lineupRows.push(this.buildLineupRow(matchId, homeTeamId, match.home));
      lineupRows.push(this.buildLineupRow(matchId, awayTeamId, match.away!));
    }
    for (const match of matchesWithoutAway) {
      const homeTeamId = await this.resolveTeamId(match.home.teamName);
      if (!homeTeamId) throw new Error(`Squadra home non trovata: "${match.home.teamName}"`);
      const matchId = matchIdByTeams.get(`${homeTeamId}:null`);
      if (!matchId) throw new Error(`Partita senza avversario non trovata per ${homeTeamId}`);

      lineupRows.push(this.buildLineupRow(matchId, homeTeamId, match.home));
    }

    const { data: lineupRowsDb, error: lineupError } = await this.client
      .from('lineups')
      .upsert(lineupRows as never, { onConflict: 'match_id, team_id' })
      .select('id, match_id, team_id');
    if (lineupError || !lineupRowsDb) throw new Error(`Errore upsert formazioni: ${lineupError?.message ?? 'riga assente'}`);

    const lineupIds = lineupRowsDb.map((row) => row.id);
    if (lineupIds.length > 0) {
      const { error: deleteError } = await this.client
        .from('lineup_players')
        .delete()
        .in('lineup_id', lineupIds);
      if (deleteError) throw new Error(`Errore cancellazione formazioni precedenti: ${deleteError.message}`);
    }

    const lineupIdByKey = new Map<string, string>();
    for (const row of lineupRowsDb) {
      lineupIdByKey.set(`${row.match_id}:${row.team_id}`, row.id);
    }

    const playerRows: Record<string, unknown>[] = [];
    for (const match of input.matches) {
      const homeTeamId = await this.resolveTeamId(match.home.teamName);
      if (!homeTeamId) throw new Error(`Squadra home non trovata: "${match.home.teamName}"`);

      if (match.away) {
        const awayTeamId = await this.resolveTeamId(match.away.teamName);
        if (!awayTeamId) throw new Error(`Squadra away non trovata: "${match.away.teamName}"`);
        const matchId = matchIdByTeams.get(`${homeTeamId}:${awayTeamId}`);
        if (!matchId) continue;

        const homeLineupId = lineupIdByKey.get(`${matchId}:${homeTeamId}`);
        const awayLineupId = lineupIdByKey.get(`${matchId}:${awayTeamId}`);
        if (!homeLineupId || !awayLineupId) throw new Error(`Lineup non trovata per partita`);

        await this.collectLineupPlayers(homeLineupId, match.home, playerRows);
        await this.collectLineupPlayers(awayLineupId, match.away, playerRows);
      } else {
        const matchId = matchIdByTeams.get(`${homeTeamId}:null`);
        if (!matchId) continue;
        const homeLineupId = lineupIdByKey.get(`${matchId}:${homeTeamId}`);
        if (!homeLineupId) throw new Error(`Lineup non trovata per partita senza avversario`);

        await this.collectLineupPlayers(homeLineupId, match.home, playerRows);
      }
    }

    if (playerRows.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < playerRows.length; i += batchSize) {
        const chunk = playerRows.slice(i, i + batchSize);
        const { error } = await this.client.from('lineup_players').insert(chunk as never);
        if (error) throw new Error(`Errore inserimento giocatori formazione: ${error.message}`);
      }
    }
  }

  private buildLineupRow(
    matchId: string,
    teamId: string,
    team: LineupImport['matches'][number]['home'],
  ): Record<string, unknown> {
    return {
      match_id: matchId,
      team_id: teamId,
      formation: team.formation ?? null,
      defense_modifier: team.defenseModifier,
      field_advantage: team.fieldAdvantage,
      submitted_via: team.submittedVia ?? null,
      submitted_at: team.submittedAt ?? null,
    };
  }

  private async collectLineupPlayers(
    lineupId: string,
    team: LineupImport['matches'][number]['home'],
    out: Record<string, unknown>[],
  ): Promise<void> {
    for (const [index, player] of team.players.entries()) {
      const playerId = await this.resolvePlayerId(player.playerName);
      if (!playerId) throw new Error(`Giocatore non trovato in formazione: "${player.playerName}"`);
      out.push({
        lineup_id: lineupId,
        player_id: playerId,
        slot: player.slot,
        position_order: index + 1,
        voto: player.voto,
        fantavoto: player.fantavoto,
        counts_for_total: player.countsForTotal,
      });
    }
  }

  // ============================================================
  // Bonus/malus per giornata
  // ============================================================

  async upsertMatchdayBonuses(input: BonusImport): Promise<void> {
    const seasonId = await this.getSeasonId(input.seasonSlug);
    const competitionId = await this.getCompetitionId(seasonId, input.competitionSlug);

    const { data: matchdayRow, error: matchdayError } = await this.client
      .from('matchdays')
      .upsert(
        { competition_id: competitionId, number: input.matchdayNumber },
        { onConflict: 'competition_id, number' },
      )
      .select('id')
      .single();
    if (matchdayError || !matchdayRow) throw new Error(`Errore upsert giornata bonus: ${matchdayError?.message ?? 'riga assente'}`);

    const { error: deleteError } = await this.client
      .from('player_matchday_bonuses')
      .delete()
      .eq('matchday_id', matchdayRow.id);
    if (deleteError) throw new Error(`Errore cancellazione bonus precedenti: ${deleteError.message}`);

    const rows: Record<string, unknown>[] = [];
    for (const player of input.players) {
      const playerId = await this.resolvePlayerId(player.playerName);
      if (!playerId) throw new Error(`Giocatore non trovato per i bonus: "${player.playerName}"`);
      player.bonusCodes.forEach((code, index) => {
        rows.push({ matchday_id: matchdayRow.id, player_id: playerId, kind_code: code, position_order: index + 1 });
      });
    }
    if (rows.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        const { error } = await this.client.from('player_matchday_bonuses').insert(chunk as never);
        if (error) throw new Error(`Errore inserimento bonus: ${error.message}`);
      }
    }
  }

  // ============================================================
  // Helpers di lettura per i test
  // ============================================================

  // ponytail: implementazioni minime per soddisfare l'interfaccia. Saranno
  // estese quando serviranno davvero (test di integrazione, pannello admin).
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async getStandings(competitionSlug: string): Promise<StandingsImport['rows']> {
    return [];
  }

  async getRoster(seasonSlug: string): Promise<RosterImport['entries']> {
    return [];
  }

  async getTeamCredits(seasonSlug: string): Promise<RosterImport['teamCredits']> {
    return [];
  }

  async getCalendar(competitionSlug: string): Promise<CalendarImport['matchdays']> {
    return [];
  }

  async getLineup(competitionSlug: string, matchdayNumber: number): Promise<LineupImport['matches']> {
    return [];
  }

  async getMatchdayBonuses(competitionSlug: string, matchdayNumber: number): Promise<BonusImport['players']> {
    return [];
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
