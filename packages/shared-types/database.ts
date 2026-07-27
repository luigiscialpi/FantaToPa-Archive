// packages/shared-types/database.ts
//
// Generato introspezionando lo schema live testato in Fase 0 (information_schema),
// non `supabase gen types typescript --db-url`: quel percorso locale richiede un
// container runtime (podman/docker) non disponibile in questo sandbox.
//
// DA RIGENERARE con il comando vero una volta che esiste un progetto Supabase reale:
//   npx supabase gen types typescript --project-id <ref> > packages/shared-types/database.ts
// Quel percorso (via project-id, non db-url) chiama l'API hosted di Supabase e
// non ha bisogno di un container locale — funzionerà normalmente per te/in CI.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      competition_formats: {
        Row: {
          code: string;
          label: string;
        };
      };
      competition_kinds: {
        Row: {
          code: string;
          label: string;
        };
      };
      competitions: {
        Row: {
          id: string;
          season_id: string;
          parent_competition_id: string | null;
          name: string;
          kind_code: string;
          format_code: string;
          slug: string;
        };
      };
      import_batches: {
        Row: {
          id: string;
          season_id: string | null;
          source_type_code: string;
          source_file: string;
          file_hash: string;
          status: string;
          imported_by: string | null;
          created_at: string;
          confirmed_at: string | null;
        };
      };
      import_source_types: {
        Row: {
          code: string;
          label: string;
        };
      };
      lineup_players: {
        Row: {
          id: string;
          lineup_id: string;
          player_id: string;
          slot: string;
          position_order: number | null;
          voto: number | null;
          fantavoto: number | null;
        };
      };
      lineups: {
        Row: {
          id: string;
          match_id: string;
          team_id: string;
          formation: string | null;
        };
      };
      market_values: {
        Row: {
          id: string;
          season_id: string;
          player_id: string;
          role_code: string | null;
          real_team: string | null;
          initial_quote: number | null;
          current_quote: number | null;
        };
      };
      matchdays: {
        Row: {
          id: string;
          competition_id: string;
          number: number;
          label: string | null;
        };
      };
      matches: {
        Row: {
          id: string;
          matchday_id: string;
          home_team_id: string;
          away_team_id: string;
          home_score: number | null;
          away_score: number | null;
          home_result_points: number | null;
          away_result_points: number | null;
        };
      };
      player_aliases: {
        Row: {
          id: string;
          player_id: string;
          alias_normalized: string;
        };
      };
      player_roles: {
        Row: {
          player_id: string;
          season_id: string;
          role_code: string;
        };
      };
      players: {
        Row: {
          id: string;
          canonical_name: string;
          slug: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          role: string;
          status: string;
          team_id: string | null;
          first_name: string | null;
          last_name: string | null;
        };
      };
      registration_requests: {
        Row: {
          id: string;
          auth_user_id: string;
          first_name: string | null;
          last_name: string | null;
          requested_team_id: string | null;
          status: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
      };
      roles: {
        Row: {
          code: string;
          label: string;
          ruleset: string;
        };
      };
      rosters: {
        Row: {
          id: string;
          season_id: string;
          team_id: string;
          player_id: string;
          real_team: string | null;
          cost: number | null;
        };
      };
      seasons: {
        Row: {
          id: string;
          slug: string;
          label: string;
          starts_on: string | null;
          ends_on: string | null;
          rules: Json;
          created_at: string;
        };
      };
      standings: {
        Row: {
          id: string;
          competition_id: string;
          team_id: string;
          position: number | null;
          played: number | null;
          won: number | null;
          drawn: number | null;
          lost: number | null;
          goals_for: number | null;
          goals_against: number | null;
          goal_diff: number | null;
          points: number | null;
          total_fantapoints: number | null;
        };
      };
      team_aliases: {
        Row: {
          id: string;
          team_id: string;
          alias_normalized: string;
        };
      };
      team_seasons: {
        Row: {
          id: string;
          team_id: string;
          season_id: string;
          manager_name: string | null;
          logo_url: string | null;
          jersey_url: string | null;
        };
      };
      teams: {
        Row: {
          id: string;
          canonical_name: string;
          slug: string;
        };
      };
    };
  };
}
