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
