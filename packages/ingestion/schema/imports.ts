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
  // Riga "Crediti Residui: N" a fine sezione squadra in Rose_x.xlsx, una per
  // squadra. Default vuoto (non opzionale) così il loader non deve
  // controllare `undefined` in più punti oltre al caso "non ancora parsato".
  teamCredits: z
    .array(
      z.object({
        teamName: z.string().min(1),
        creditsRemaining: z.number(),
      }),
    )
    .default([]),
});
export type RosterImport = z.infer<typeof RosterImportSchema>;

export const StandingsImportSchema = z.object({
  seasonSlug: z.string(),
  competitionSlug: z.string(),
  rows: z.array(
    z.object({
      teamName: z.string().min(1),
      position: z.number().int().positive(),
      // Le classifiche di Coppa contengono solo G, Pt, Pt. Totali — i campi
      // V/N/P/Gf/Gs sono assenti. Sono opzionali nello schema canonico.
      played: z.number().int().nonnegative().optional(),
      won: z.number().int().nonnegative().optional(),
      drawn: z.number().int().nonnegative().optional(),
      lost: z.number().int().nonnegative().optional(),
      goalsFor: z.number().int().nonnegative().optional(),
      goalsAgainst: z.number().int().nonnegative().optional(),
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
  // Gol reali della partita, dal campo "risultato" del calendario (es.
  // "2-2"): distinti da homeScore/awayScore che sono il fantavoto. Servono
  // per calcolare Gf/Gs/Dr su un intervallo di giornate, non solo sullo
  // snapshot finale in `standings`.
  homeGoals: z.number().int().min(0),
  awayGoals: z.number().int().min(0),
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
  // Nel file, il fantavoto dei giocatori che contribuiscono al totale
  // squadra è in verde (nota nel foglio: "In verde i fantavoti che portano
  // punteggio alla squadra"); gli altri (non giocati, o sostituti il cui
  // voto non serve perché il titolare ha giocato) sono in un colore più
  // leggero. Non deducibile da voto/fantavoto null: un giocatore può avere
  // un fantavoto reale e comunque non contare — va letto dal colore font,
  // vedi rilevazione colore nell'adapter xlsx.
  countsForTotal: z.boolean(),
});
export type LineupPlayerImport = z.infer<typeof LineupPlayerImportSchema>;

export const LineupTeamImportSchema = z.object({
  teamName: z.string().min(1),
  formation: z.string().optional(),
  // Assente nel file quando il modificatore è zero, non quando manca il
  // dato: default 0 qui invece di lasciarlo optional a valle.
  defenseModifier: z.number().int().default(0),
  // Solo nei file di Coppa Fase Finale (eliminazione diretta): bonus per chi
  // ha il vantaggio campo in quel turno. Assente altrove, stesso default 0
  // di defenseModifier per lo stesso motivo (assente = non applicabile, non
  // dato mancante).
  fieldAdvantage: z.number().int().default(0),
  total: z.number(),
  players: z.array(LineupPlayerImportSchema),
  // Riga "Inserita via app/web il DD-MM-YYYY HH:mm:ss" in fondo a ogni
  // formazione squadra. submittedAt resta una stringa "as-is" (formato
  // sorgente DD-MM-YYYY HH:mm:ss riportato as ISO naive, senza fuso) — solo
  // informativo/display, non usato per confronti cross-timezone.
  submittedVia: z.enum(['app', 'web']).optional(),
  submittedAt: z.string().optional(),
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
// Forma "pre-parse" (defenseModifier ancora opzionale, non ha ancora preso
// il default 0): usata dagli adapter per costruire l'oggetto che poi viene
// passato a LineupImportSchema.parse(...).
export type LineupImportInput = z.input<typeof LineupImportSchema>;

// Bonus/malus granulari per giocatore reale, dalla pagina "Voti" di
// leghe.fantacalcio.it (fonte distinta dagli xlsx Formazioni — vedi
// migrazione 20260731090000). L'adapter mappa già le etichette italiane
// della fonte (es. "Gol segnato (+3)") sui `code` di bonus_kinds prima di
// arrivare qui: niente z.enum per non duplicare l'elenco codici già nella
// migrazione, un code non riconosciuto fallisce rumorosamente nell'adapter
// (messaggio con il testo esatto della fonte), non con una FK violation
// generica a valle nel loader.
export const BonusPlayerImportSchema = z.object({
  playerName: z.string().min(1),
  // Codici bonus_kinds nell'ordine in cui appaiono nella fonte (un
  // giocatore può avere più eventi dello stesso tipo, es. doppietta).
  bonusCodes: z.array(z.string()),
});
export type BonusPlayerImport = z.infer<typeof BonusPlayerImportSchema>;

export const BonusImportSchema = z.object({
  seasonSlug: z.string(),
  competitionSlug: z.string(),
  matchdayNumber: z.number().int().positive(),
  // Un giocatore reale per riga: se la stessa giornata lo schiera più di
  // una squadra fantacalcio, la fonte lo ripete più volte nello stesso file
  // (una volta per formazione) — l'adapter deduplica per nome, verificando
  // che le occorrenze ripetute abbiano lo stesso set di bonus (altrimenti è
  // un bug del parser, non un dato realmente divergente: è lo stesso evento
  // reale di Serie A).
  players: z.array(BonusPlayerImportSchema),
});
export type BonusImport = z.infer<typeof BonusImportSchema>;

