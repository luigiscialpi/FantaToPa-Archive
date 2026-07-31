export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      competition_formats: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      competition_kinds: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      competitions: {
        Row: {
          format_code: string
          id: string
          kind_code: string
          name: string
          parent_competition_id: string | null
          season_id: string
          slug: string
        }
        Insert: {
          format_code: string
          id?: string
          kind_code: string
          name: string
          parent_competition_id?: string | null
          season_id: string
          slug: string
        }
        Update: {
          format_code?: string
          id?: string
          kind_code?: string
          name?: string
          parent_competition_id?: string | null
          season_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_format_code_fkey"
            columns: ["format_code"]
            isOneToOne: false
            referencedRelation: "competition_formats"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "competitions_kind_code_fkey"
            columns: ["kind_code"]
            isOneToOne: false
            referencedRelation: "competition_kinds"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "competitions_parent_competition_id_fkey"
            columns: ["parent_competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          confirmed_at: string | null
          created_at: string
          file_hash: string
          id: string
          imported_by: string | null
          season_id: string | null
          source_file: string
          source_type_code: string
          status: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          file_hash: string
          id?: string
          imported_by?: string | null
          season_id?: string | null
          source_file: string
          source_type_code: string
          status?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          file_hash?: string
          id?: string
          imported_by?: string | null
          season_id?: string | null
          source_file?: string
          source_type_code?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_source_type_code_fkey"
            columns: ["source_type_code"]
            isOneToOne: false
            referencedRelation: "import_source_types"
            referencedColumns: ["code"]
          },
        ]
      }
      import_source_types: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      lineup_players: {
        Row: {
          counts_for_total: boolean
          fantavoto: number | null
          id: string
          lineup_id: string
          player_id: string
          position_order: number | null
          slot: string
          voto: number | null
        }
        Insert: {
          counts_for_total?: boolean
          fantavoto?: number | null
          id?: string
          lineup_id: string
          player_id: string
          position_order?: number | null
          slot: string
          voto?: number | null
        }
        Update: {
          counts_for_total?: boolean
          fantavoto?: number | null
          id?: string
          lineup_id?: string
          player_id?: string
          position_order?: number | null
          slot?: string
          voto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lineup_players_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          defense_modifier: number
          field_advantage: number
          formation: string | null
          id: string
          match_id: string
          submitted_at: string | null
          submitted_via: string | null
          team_id: string
        }
        Insert: {
          defense_modifier?: number
          field_advantage?: number
          formation?: string | null
          id?: string
          match_id: string
          submitted_at?: string | null
          submitted_via?: string | null
          team_id: string
        }
        Update: {
          defense_modifier?: number
          field_advantage?: number
          formation?: string | null
          id?: string
          match_id?: string
          submitted_at?: string | null
          submitted_via?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      market_values: {
        Row: {
          current_quote: number | null
          id: string
          initial_quote: number | null
          player_id: string
          real_team: string | null
          role_code: string | null
          season_id: string
        }
        Insert: {
          current_quote?: number | null
          id?: string
          initial_quote?: number | null
          player_id: string
          real_team?: string | null
          role_code?: string | null
          season_id: string
        }
        Update: {
          current_quote?: number | null
          id?: string
          initial_quote?: number | null
          player_id?: string
          real_team?: string | null
          role_code?: string | null
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_values_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_values_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "market_values_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      matchdays: {
        Row: {
          competition_id: string
          id: string
          label: string | null
          number: number
        }
        Insert: {
          competition_id: string
          id?: string
          label?: string | null
          number: number
        }
        Update: {
          competition_id?: string
          id?: string
          label?: string | null
          number?: number
        }
        Relationships: [
          {
            foreignKeyName: "matchdays_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_goals: number | null
          away_result_points: number | null
          away_score: number | null
          away_team_id: string
          home_goals: number | null
          home_result_points: number | null
          home_score: number | null
          home_team_id: string
          id: string
          matchday_id: string
        }
        Insert: {
          away_goals?: number | null
          away_result_points?: number | null
          away_score?: number | null
          away_team_id: string
          home_goals?: number | null
          home_result_points?: number | null
          home_score?: number | null
          home_team_id: string
          id?: string
          matchday_id: string
        }
        Update: {
          away_goals?: number | null
          away_result_points?: number | null
          away_score?: number | null
          away_team_id?: string
          home_goals?: number | null
          home_result_points?: number | null
          home_score?: number | null
          home_team_id?: string
          id?: string
          matchday_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
        ]
      }
      player_aliases: {
        Row: {
          alias_normalized: string
          id: string
          player_id: string
        }
        Insert: {
          alias_normalized: string
          id?: string
          player_id: string
        }
        Update: {
          alias_normalized?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_aliases_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_roles: {
        Row: {
          player_id: string
          role_code: string
          season_id: string
        }
        Insert: {
          player_id: string
          role_code: string
          season_id: string
        }
        Update: {
          player_id?: string
          role_code?: string
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_roles_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_roles_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "player_roles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          canonical_name: string
          id: string
          slug: string
        }
        Insert: {
          canonical_name: string
          id?: string
          slug: string
        }
        Update: {
          canonical_name?: string
          id?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          first_name: string | null
          id: string
          last_name: string | null
          role: string
          status: string
          team_id: string | null
        }
        Insert: {
          first_name?: string | null
          id: string
          last_name?: string | null
          role?: string
          status?: string
          team_id?: string | null
        }
        Update: {
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
          status?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_requests: {
        Row: {
          auth_user_id: string
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          requested_team_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          requested_team_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          requested_team_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_requests_requested_team_id_fkey"
            columns: ["requested_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          label: string
          ruleset: string
        }
        Insert: {
          code: string
          label: string
          ruleset?: string
        }
        Update: {
          code?: string
          label?: string
          ruleset?: string
        }
        Relationships: []
      }
      rosters: {
        Row: {
          cost: number | null
          id: string
          player_id: string
          real_team: string | null
          season_id: string
          team_id: string
        }
        Insert: {
          cost?: number | null
          id?: string
          player_id: string
          real_team?: string | null
          season_id: string
          team_id: string
        }
        Update: {
          cost?: number | null
          id?: string
          player_id?: string
          real_team?: string | null
          season_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rosters_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rosters_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rosters_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          label: string
          rules: Json
          slug: string
          starts_on: string | null
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          label: string
          rules?: Json
          slug: string
          starts_on?: string | null
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          label?: string
          rules?: Json
          slug?: string
          starts_on?: string | null
        }
        Relationships: []
      }
      standings: {
        Row: {
          competition_id: string
          drawn: number | null
          goal_diff: number | null
          goals_against: number | null
          goals_for: number | null
          id: string
          lost: number | null
          played: number | null
          points: number | null
          position: number | null
          team_id: string
          total_fantapoints: number | null
          won: number | null
        }
        Insert: {
          competition_id: string
          drawn?: number | null
          goal_diff?: number | null
          goals_against?: number | null
          goals_for?: number | null
          id?: string
          lost?: number | null
          played?: number | null
          points?: number | null
          position?: number | null
          team_id: string
          total_fantapoints?: number | null
          won?: number | null
        }
        Update: {
          competition_id?: string
          drawn?: number | null
          goal_diff?: number | null
          goals_against?: number | null
          goals_for?: number | null
          id?: string
          lost?: number | null
          played?: number | null
          points?: number | null
          position?: number | null
          team_id?: string
          total_fantapoints?: number | null
          won?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "standings_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_aliases: {
        Row: {
          alias_normalized: string
          id: string
          team_id: string
        }
        Insert: {
          alias_normalized: string
          id?: string
          team_id: string
        }
        Update: {
          alias_normalized?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_aliases_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_seasons: {
        Row: {
          credits_remaining: number | null
          display_name: string | null
          id: string
          jersey_url: string | null
          logo_url: string | null
          manager_name: string | null
          season_id: string
          team_id: string
        }
        Insert: {
          credits_remaining?: number | null
          display_name?: string | null
          id?: string
          jersey_url?: string | null
          logo_url?: string | null
          manager_name?: string | null
          season_id: string
          team_id: string
        }
        Update: {
          credits_remaining?: number | null
          display_name?: string | null
          id?: string
          jersey_url?: string | null
          logo_url?: string | null
          manager_name?: string | null
          season_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_seasons_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_seasons_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          canonical_name: string
          id: string
          slug: string
        }
        Insert: {
          canonical_name: string
          id?: string
          slug: string
        }
        Update: {
          canonical_name?: string
          id?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_registration: { Args: { request_id: string }; Returns: undefined }
      can_read_league_data: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      reject_registration: { Args: { request_id: string }; Returns: undefined }
      team_managers: {
        Args: never
        Returns: {
          display_name: string
          team_id: string
        }[]
      }
      teams_available_for_registration: {
        Args: never
        Returns: {
          canonical_name: string
          id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
