// packages/ingestion/schema/imports.ts
//
// Uno schema per concern, rispecchia i file sorgente reali (Rose_x.xlsx,
// Classifica_x.xlsx, Calendario_x.xlsx sono già file separati — sezione 7
// del piano). Ogni adapter produce uno di questi tipi, validato qui prima
// di arrivare al loader.
import { z } from 'zod';

export const TeamImportSchema = z.object({
  name: z.string().min(1),
  logoPath: z.string().optional(),
  jerseyPath: z.string().optional(),
});
export type TeamImport = z.infer<typeof TeamImportSchema>;

export const RosterImportSchema = z.object({
  seasonSlug: z.string(),
  entries: z.array(
    z.object({
      teamName: z.string().min(1),
      playerName: z.string().min(1),
      roles: z.array(z.string()).min(1),
      realTeam: z.string().optional(),
      cost: z.number().nonnegative().optional(),
    }),
  ),
});
export type RosterImport = z.infer<typeof RosterImportSchema>;

export const StandingsImportSchema = z.object({
  seasonSlug: z.string(),
  competitionSlug: z.string(),
  rows: z.array(
    z.object({
      teamName: z.string().min(1),
      position: z.number().int().positive(),
      played: z.number().int().nonnegative(),
      won: z.number().int().nonnegative(),
      drawn: z.number().int().nonnegative(),
      lost: z.number().int().nonnegative(),
      goalsFor: z.number().int().nonnegative(),
      goalsAgainst: z.number().int().nonnegative(),
      points: z.number().int().nonnegative(),
      totalFantapoints: z.number(),
    }),
  ),
});
export type StandingsImport = z.infer<typeof StandingsImportSchema>;

export const CalendarMatchImportSchema = z.object({
  homeTeamName: z.string().min(1),
  awayTeamName: z.string().min(1),
  homeScore: z.number(),
  awayScore: z.number(),
  homeResultPoints: z.number().int().min(0).max(3),
  awayResultPoints: z.number().int().min(0).max(3),
});
export type CalendarMatchImport = z.infer<typeof CalendarMatchImportSchema>;

export const CalendarMatchdayImportSchema = z.object({
  number: z.number().int().positive(),
  label: z.string().optional(),
  matches: z.array(CalendarMatchImportSchema),
});
export type CalendarMatchdayImport = z.infer<typeof CalendarMatchdayImportSchema>;

export const CalendarImportSchema = z.object({
  seasonSlug: z.string(),
  competitionSlug: z.string(),
  matchdays: z.array(CalendarMatchdayImportSchema),
});
export type CalendarImport = z.infer<typeof CalendarImportSchema>;

export const LineupPlayerImportSchema = z.object({
  playerName: z.string().min(1),
  // Ruoli grezzi dal file (es. "Ds;E"). Per lineup_players non usiamo un
  // singolo ruolo perché il file non dice chiaramente se è quello schierato
  // o l'insieme idonei (nota aperta in sezione 6 del piano).
  roles: z.array(z.string()),
  voto: z.number().nullable(),
  fantavoto: z.number().nullable(),
  slot: z.enum(['titolare', 'panchina']),
});
export type LineupPlayerImport = z.infer<typeof LineupPlayerImportSchema>;

export const LineupTeamImportSchema = z.object({
  teamName: z.string().min(1),
  formation: z.string().optional(),
  defenseModifier: z.number().int().optional(),
  total: z.number(),
  players: z.array(LineupPlayerImportSchema),
});
export type LineupTeamImport = z.infer<typeof LineupTeamImportSchema>;

export const LineupMatchImportSchema = z.object({
  home: LineupTeamImportSchema,
  away: LineupTeamImportSchema,
});
export type LineupMatchImport = z.infer<typeof LineupMatchImportSchema>;

export const LineupImportSchema = z.object({
  seasonSlug: z.string(),
  competitionSlug: z.string(),
  matchdayNumber: z.number().int().positive(),
  matchdayLabel: z.string().optional(),
  matches: z.array(LineupMatchImportSchema),
});
export type LineupImport = z.infer<typeof LineupImportSchema>;

