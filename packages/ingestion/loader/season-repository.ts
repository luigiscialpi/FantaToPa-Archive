// packages/ingestion/loader/season-repository.ts
//
// Il loader dipende da questa interfaccia, mai direttamente dal client
// Supabase (sezione 6 del piano) — permette di testare upsert/idempotenza
// e risoluzione alias senza rete né DB reale.
import { normalizeName } from '../lib/normalize-name.js';
import type {
  CalendarImport,
  LineupImport,
  RosterImport,
  StandingsImport,
} from '../schema/imports.js';

export type TeamSeed = {
  name: string;
  aliases?: string[];
};

export type PlayerSeed = {
  name: string;
  aliases?: string[];
};

export interface SeasonRepository {
  // Risoluzione alias: torna l'id se il nome (o un suo alias normalizzato)
  // è già noto, altrimenti undefined. Il loader usa questo per segnalare
  // nomi non riconosciuti invece di crearli silenziosamente.
  resolveTeamId(name: string): Promise<string | undefined>;
  resolvePlayerId(name: string): Promise<string | undefined>;

  // Bootstrap di squadre/giocatori: crea le entità canoniche e i loro alias.
  // Usato dal seed iniziale, non durante ogni import.
  upsertTeams(teams: TeamSeed[]): Promise<void>;
  upsertPlayers(players: PlayerSeed[]): Promise<void>;

  // Import veri e propri, uno per concern (sezione 7 del piano).
  upsertRoster(input: RosterImport): Promise<void>;
  upsertStandings(input: StandingsImport): Promise<void>;
  upsertCalendar(input: CalendarImport): Promise<void>;
  upsertLineup(input: LineupImport): Promise<void>;

  // Helpers di lettura per i test.
  getStandings(competitionSlug: string): Promise<StandingsImport['rows']>;
  getRoster(seasonSlug: string): Promise<RosterImport['entries']>;
  getTeamCredits(seasonSlug: string): Promise<RosterImport['teamCredits']>;
  getCalendar(competitionSlug: string): Promise<CalendarImport['matchdays']>;
  getLineup(competitionSlug: string, matchdayNumber: number): Promise<LineupImport['matches']>;
}

// ponytail: implementazione in memoria sufficiente per testare logica di
// upsert/idempotenza e alias. Non tenta di replicare la semantica SQL di
// Supabase (es. vincoli FK, trigger): per quello servono test sul DB reale.
export class InMemorySeasonRepository implements SeasonRepository {
  private teams = new Map<string, { id: string; canonicalName: string }>();
  private teamAliases = new Map<string, string>(); // normalized -> team id
  private players = new Map<string, { id: string; canonicalName: string }>();
  private playerAliases = new Map<string, string>(); // normalized -> player id

  private standings = new Map<string, StandingsImport['rows']>();
  private rosters = new Map<string, RosterImport['entries']>();
  private teamCredits = new Map<string, RosterImport['teamCredits']>();
  private calendars = new Map<string, CalendarImport['matchdays']>();
  private lineups = new Map<string, LineupImport['matches']>();

  private nextId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  async resolveTeamId(name: string): Promise<string | undefined> {
    const key = normalizeName(name);
    const direct = this.teams.get(key);
    if (direct) return direct.id;
    return this.teamAliases.get(key);
  }

  async resolvePlayerId(name: string): Promise<string | undefined> {
    const key = normalizeName(name);
    const direct = this.players.get(key);
    if (direct) return direct.id;
    return this.playerAliases.get(key);
  }

  async upsertTeams(teams: TeamSeed[]): Promise<void> {
    for (const team of teams) {
      const canonicalKey = normalizeName(team.name);
      const id = this.nextId('team');
      this.teams.set(canonicalKey, { id, canonicalName: team.name });
      for (const alias of team.aliases ?? []) {
        this.teamAliases.set(normalizeName(alias), id);
      }
    }
  }

  async upsertPlayers(players: PlayerSeed[]): Promise<void> {
    for (const player of players) {
      const canonicalKey = normalizeName(player.name);
      const id = this.nextId('player');
      this.players.set(canonicalKey, { id, canonicalName: player.name });
      for (const alias of player.aliases ?? []) {
        this.playerAliases.set(normalizeName(alias), id);
      }
    }
  }

  async upsertRoster(input: RosterImport): Promise<void> {
    // Idempotente: sovrascrive l'intera rosa della stagione.
    this.rosters.set(input.seasonSlug, input.entries);
    this.teamCredits.set(input.seasonSlug, input.teamCredits);
  }

  async upsertStandings(input: StandingsImport): Promise<void> {
    // Upsert su chiave naturale (competitionSlug), non insert cieco — coerente
    // con "import idempotenti" di sezione 3: rilanciare due volte non duplica.
    this.standings.set(input.competitionSlug, input.rows);
  }

  async upsertCalendar(input: CalendarImport): Promise<void> {
    this.calendars.set(input.competitionSlug, input.matchdays);
  }

  async upsertLineup(input: LineupImport): Promise<void> {
    const key = `${input.competitionSlug}:${input.matchdayNumber}`;
    this.lineups.set(key, input.matches);
  }

  async getStandings(competitionSlug: string): Promise<StandingsImport['rows']> {
    return this.standings.get(competitionSlug) ?? [];
  }

  async getRoster(seasonSlug: string): Promise<RosterImport['entries']> {
    return this.rosters.get(seasonSlug) ?? [];
  }

  async getTeamCredits(seasonSlug: string): Promise<RosterImport['teamCredits']> {
    return this.teamCredits.get(seasonSlug) ?? [];
  }

  async getCalendar(competitionSlug: string): Promise<CalendarImport['matchdays']> {
    return this.calendars.get(competitionSlug) ?? [];
  }

  async getLineup(competitionSlug: string, matchdayNumber: number): Promise<LineupImport['matches']> {
    return this.lineups.get(`${competitionSlug}:${matchdayNumber}`) ?? [];
  }
}
