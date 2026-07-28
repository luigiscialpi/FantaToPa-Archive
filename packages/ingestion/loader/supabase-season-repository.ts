// packages/ingestion/loader/supabase-season-repository.ts
//
// Implementazione reale di SeasonRepository su Supabase. Usa service role key,
// quindi va eseguita solo server-side (script di ingestion).
import { createIngestionClient } from '../lib/supabase-client.js';
import { normalizeName } from '../lib/normalize-name.js';
import type {
  SeasonRepository,
  TeamSeed,
  PlayerSeed,
} from './season-repository.js';
import type {
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

  constructor(client?: SupabaseClient) {
    this.client = client ?? createIngestionClient();
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
    const { data: direct } = await this.client
      .from('teams')
      .select('id')
      .ilike('canonical_name', name.trim())
      .maybeSingle();
    if (direct) return direct.id;

    const { data: alias } = await this.client
      .from('team_aliases')
      .select('team_id')
      .eq('alias_normalized', key)
      .maybeSingle();
    return alias?.team_id ?? undefined;
  }

  async resolvePlayerId(name: string): Promise<string | undefined> {
    const key = normalizeName(name);
    const { data: direct } = await this.client
      .from('players')
      .select('id')
      .ilike('canonical_name', name.trim())
      .maybeSingle();
    if (direct) return direct.id;

    const { data: alias } = await this.client
      .from('player_aliases')
      .select('player_id')
      .eq('alias_normalized', key)
      .maybeSingle();
    return alias?.player_id ?? undefined;
  }

  // ============================================================
  // Seed squadre/giocatori
  // ============================================================

  async upsertTeams(teams: TeamSeed[]): Promise<void> {
    for (const team of teams) {
      const canonicalName = team.name.trim();
      const slug = slugify(canonicalName);

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

      await this.ensureTeamAliases(data.id, [canonicalName, ...(team.aliases ?? [])]);
    }
  }

  private async ensureTeamAliases(teamId: string, aliases: string[]): Promise<void> {
    const rows = aliases
      .map((a) => normalizeName(a))
      .filter(Boolean)
      .map((alias_normalized) => ({ team_id: teamId, alias_normalized }));
    if (rows.length === 0) return;

    const { error } = await this.client.from('team_aliases').upsert(rows, { onConflict: 'alias_normalized' });
    if (error) throw new Error(`Errore alias squadra: ${error.message}`);
  }

  async upsertPlayers(players: PlayerSeed[]): Promise<void> {
    for (const player of players) {
      const canonicalName = player.name.trim();
      const slug = slugify(canonicalName);

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

      await this.ensurePlayerAliases(data.id, [canonicalName, ...(player.aliases ?? [])]);
    }
  }

  async ensurePlayerAliases(playerId: string, aliases: string[]): Promise<void> {
    const rows = aliases
      .map((a) => normalizeName(a))
      .filter(Boolean)
      .map((alias_normalized) => ({ player_id: playerId, alias_normalized }));
    if (rows.length === 0) return;

    const { error } = await this.client.from('player_aliases').upsert(rows, { onConflict: 'alias_normalized' });
    if (error) throw new Error(`Errore alias giocatore: ${error.message}`);
  }

  // ============================================================
  // Roster
  // ============================================================

  async upsertRoster(input: RosterImport): Promise<void> {
    const seasonId = await this.getSeasonId(input.seasonSlug);

    for (const entry of input.entries) {
      const teamId = await this.resolveTeamId(entry.teamName);
      if (!teamId) throw new Error(`Squadra non trovata per la rosa: "${entry.teamName}"`);

      const playerId = await this.resolvePlayerId(entry.playerName);
      if (!playerId) throw new Error(`Giocatore non trovato per la rosa: "${entry.playerName}"`);

      const { error: rosterError } = await this.client.from('rosters').upsert(
        {
          season_id: seasonId,
          team_id: teamId,
          player_id: playerId,
          real_team: entry.realTeam ?? null,
          cost: entry.cost ?? null,
        },
        { onConflict: 'season_id, team_id, player_id' },
      );
      if (rosterError) throw new Error(`Errore upsert rosa: ${rosterError.message}`);

      for (const roleCode of entry.roles) {
        const { error: roleError } = await this.client.from('player_roles').upsert(
          { player_id: playerId, season_id: seasonId, role_code: roleCode },
          { onConflict: 'player_id, season_id, role_code' },
        );
        if (roleError) throw new Error(`Errore upsert ruolo giocatore: ${roleError.message}`);
      }
    }
  }

  // ============================================================
  // Standings
  // ============================================================

  async upsertStandings(input: StandingsImport): Promise<void> {
    const seasonId = await this.getSeasonId(input.seasonSlug);
    const competitionId = await this.getCompetitionId(seasonId, input.competitionSlug);

    for (const row of input.rows) {
      const teamId = await this.resolveTeamId(row.teamName);
      if (!teamId) throw new Error(`Squadra non trovata in classifica: "${row.teamName}"`);

      const { error } = await this.client.from('standings').upsert(
        {
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
          points: row.points,
          total_fantapoints: row.totalFantapoints,
        },
        { onConflict: 'competition_id, team_id' },
      );
      if (error) throw new Error(`Errore upsert classifica: ${error.message}`);
    }
  }

  // ============================================================
  // Calendar
  // ============================================================

  async upsertCalendar(input: CalendarImport): Promise<void> {
    const seasonId = await this.getSeasonId(input.seasonSlug);
    const competitionId = await this.getCompetitionId(seasonId, input.competitionSlug);

    for (const matchday of input.matchdays) {
      const { data: matchdayRow, error: matchdayError } = await this.client
        .from('matchdays')
        .upsert(
          { competition_id: competitionId, number: matchday.number, label: matchday.label ?? null },
          { onConflict: 'competition_id, number' },
        )
        .select('id')
        .single();
      if (matchdayError || !matchdayRow) throw new Error(`Errore upsert giornata: ${matchdayError?.message ?? 'riga assente'}`);

      for (const match of matchday.matches) {
        const homeTeamId = await this.resolveTeamId(match.homeTeamName);
        const awayTeamId = await this.resolveTeamId(match.awayTeamName);
        if (!homeTeamId) throw new Error(`Squadra home non trovata: "${match.homeTeamName}"`);
        if (!awayTeamId) throw new Error(`Squadra away non trovata: "${match.awayTeamName}"`);

        const { error } = await this.client.from('matches').upsert(
          {
            matchday_id: matchdayRow.id,
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            home_score: match.homeScore,
            away_score: match.awayScore,
            home_goals: match.homeGoals,
            away_goals: match.awayGoals,
            home_result_points: match.homeResultPoints,
            away_result_points: match.awayResultPoints,
          },
          { onConflict: 'matchday_id, home_team_id, away_team_id' },
        );
        if (error) throw new Error(`Errore upsert partita: ${error.message}`);
      }
    }
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

    for (const match of input.matches) {
      const homeTeamId = await this.resolveTeamId(match.home.teamName);
      const awayTeamId = await this.resolveTeamId(match.away.teamName);
      if (!homeTeamId) throw new Error(`Squadra home non trovata: "${match.home.teamName}"`);
      if (!awayTeamId) throw new Error(`Squadra away non trovata: "${match.away.teamName}"`);

      const { data: matchRow, error: matchError } = await this.client
        .from('matches')
        .upsert(
          {
            matchday_id: matchdayRow.id,
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            home_score: match.home.total,
            away_score: match.away.total,
          },
          { onConflict: 'matchday_id, home_team_id, away_team_id' },
        )
        .select('id')
        .single();
      if (matchError || !matchRow) throw new Error(`Errore upsert partita formazioni: ${matchError?.message ?? 'riga assente'}`);

      await this.upsertLineupTeam(matchRow.id, homeTeamId, match.home);
      await this.upsertLineupTeam(matchRow.id, awayTeamId, match.away);
    }
  }

  private async upsertLineupTeam(
    matchId: string,
    teamId: string,
    team: LineupImport['matches'][number]['home'],
  ): Promise<void> {
    const { data: lineupRow, error: lineupError } = await this.client
      .from('lineups')
      .upsert(
        { match_id: matchId, team_id: teamId, formation: team.formation ?? null },
        { onConflict: 'match_id, team_id' },
      )
      .select('id')
      .single();
    if (lineupError || !lineupRow) throw new Error(`Errore upsert formazione: ${lineupError?.message ?? 'riga assente'}`);

    // Cancella i giocatori precedenti per questa lineup e reinserisce —
    // più semplice dell'upsert posizionale e garantisce coerenza.
    const { error: deleteError } = await this.client
      .from('lineup_players')
      .delete()
      .eq('lineup_id', lineupRow.id);
    if (deleteError) throw new Error(`Errore cancellazione formazione precedente: ${deleteError.message}`);

    if (team.players.length > 0) {
      const rows = await Promise.all(
        team.players.map(async (player, index) => {
          const playerId = await this.resolvePlayerId(player.playerName);
          if (!playerId) throw new Error(`Giocatore non trovato in formazione: "${player.playerName}"`);
          return {
            lineup_id: lineupRow.id,
            player_id: playerId,
            slot: player.slot,
            position_order: index + 1,
            voto: player.voto,
            fantavoto: player.fantavoto,
          };
        }),
      );
      const { error } = await this.client.from('lineup_players').insert(rows);
      if (error) throw new Error(`Errore inserimento giocatori formazione: ${error.message}`);
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

  async getCalendar(competitionSlug: string): Promise<CalendarImport['matchdays']> {
    return [];
  }

  async getLineup(competitionSlug: string, matchdayNumber: number): Promise<LineupImport['matches']> {
    return [];
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
